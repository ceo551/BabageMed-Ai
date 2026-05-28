// Package spaces — user-scoped collections of uploaded files (Claude Projects /
// Perplexity Spaces analogue). Each space contains files; text-bearing files
// are chunked at upload time and indexed via PostgreSQL full-text search.
//
// The /api/spaces/:id/context endpoint takes a free-text query and returns the
// most relevant chunks; the chat layer concatenates those into the prompt so
// model output stays grounded in the user's uploads.
package spaces

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

const (
	maxUploadBytes = 10 * 1024 * 1024 // 10 MB per file
	chunkChars     = 500              // soft chunk size
	chunkOverlap   = 60               // characters of overlap between adjacent chunks
	maxContextHits = 8                // chunks returned per /context call
)

type Space struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	Icon         string    `json:"icon"`         // emoji glyph picked at create time
	Instructions string    `json:"instructions"` // custom system prompt prefix
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	FileCount    int       `json:"fileCount"`
}

type File struct {
	ID         string    `json:"id"`
	SpaceID    string    `json:"spaceId"`
	Name       string    `json:"name"`
	Mime       string    `json:"mime"`
	SizeBytes  int64     `json:"sizeBytes"`
	MD5        string    `json:"md5"`
	HasText    bool      `json:"hasText"`
	ChunkCount int       `json:"chunkCount"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Chunk struct {
	ID       string  `json:"id"`
	FileID   string  `json:"fileId"`
	FileName string  `json:"fileName"`
	Idx      int     `json:"idx"`
	Content  string  `json:"content"`
	Score    float64 `json:"score"`
}

type Service struct {
	db   *db.DB
	auth *auth.Service
}

func New(d *db.DB, a *auth.Service) *Service { return &Service{db: d, auth: a} }

// ─── Persistence ───────────────────────────────────────────────────────────

// CreateInput is what the HTTP handler decodes from the POST body. icon /
// instructions are optional (empty string = "default").
type CreateInput struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	Icon         string `json:"icon"`
	Instructions string `json:"instructions"`
}

func (s *Service) Create(ctx context.Context, userID string, in CreateInput) (*Space, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, errors.New("name required")
	}
	if len(name) > 200 {
		return nil, errors.New("name too long")
	}
	// Clamp instructions/icon defensively; the chat layer concatenates these
	// into the system prompt, so we don't want a 1 MB blob sneaking in.
	icon := strings.TrimSpace(in.Icon)
	if len(icon) > 16 {
		icon = icon[:16]
	}
	instr := strings.TrimSpace(in.Instructions)
	if len(instr) > 8000 {
		instr = instr[:8000]
	}
	var sp Space
	err := s.db.Pool.QueryRow(ctx, `
        INSERT INTO spaces (user_id, name, description, icon, instructions)
        VALUES ($1, $2, NULLIF($3, ''), $4, $5)
        RETURNING id, name, COALESCE(description, ''), icon, instructions, created_at, updated_at
    `, userID, name, in.Description, icon, instr).Scan(
		&sp.ID, &sp.Name, &sp.Description, &sp.Icon, &sp.Instructions, &sp.CreatedAt, &sp.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &sp, nil
}

func (s *Service) List(ctx context.Context, userID string) ([]Space, error) {
	rows, err := s.db.Pool.Query(ctx, `
        SELECT s.id, s.name, COALESCE(s.description, ''), s.icon, s.instructions,
               s.created_at, s.updated_at,
               (SELECT count(*) FROM space_files f WHERE f.space_id = s.id)
        FROM spaces s
        WHERE s.user_id = $1
        ORDER BY s.updated_at DESC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Space{}
	for rows.Next() {
		var sp Space
		if err := rows.Scan(
			&sp.ID, &sp.Name, &sp.Description, &sp.Icon, &sp.Instructions,
			&sp.CreatedAt, &sp.UpdatedAt, &sp.FileCount,
		); err != nil {
			return nil, err
		}
		out = append(out, sp)
	}
	return out, rows.Err()
}

// Get returns the space row owned by `userID`. Returns pgx.ErrNoRows
// when no row matches — callers can `errors.Is(err, pgx.ErrNoRows)` to
// distinguish "not found / not yours" from a real DB error.
//
// Previously this returned (nil, nil) for the missing-row case, which
// forced every caller into a nil-check pattern that's easy to forget
// in a refactor; the writeJSON helper also maps ErrNoRows to 404, so
// surfacing it is strictly better.
func (s *Service) Get(ctx context.Context, userID, spaceID string) (*Space, error) {
	var sp Space
	err := s.db.Pool.QueryRow(ctx, `
        SELECT id, name, COALESCE(description, ''), icon, instructions,
               created_at, updated_at,
               (SELECT count(*) FROM space_files f WHERE f.space_id = $1)
        FROM spaces WHERE id = $1 AND user_id = $2
    `, spaceID, userID).Scan(
		&sp.ID, &sp.Name, &sp.Description, &sp.Icon, &sp.Instructions,
		&sp.CreatedAt, &sp.UpdatedAt, &sp.FileCount,
	)
	if err != nil {
		return nil, err
	}
	return &sp, nil
}

// UpdateInput is the PATCH body — every field optional so callers send only
// what changed. Empty (zero-length) strings are stored as such; pass nil to
// leave a column untouched.
type UpdateInput struct {
	Name         *string `json:"name,omitempty"`
	Description  *string `json:"description,omitempty"`
	Icon         *string `json:"icon,omitempty"`
	Instructions *string `json:"instructions,omitempty"`
}

func (s *Service) Update(ctx context.Context, userID, spaceID string, in UpdateInput) (*Space, error) {
	// COALESCE pattern: $N is nil => keep current value; non-nil => overwrite.
	// Apply defensive length clamps (same as Create) so a misbehaving client
	// can't blow up the system prompt.
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return nil, errors.New("name cannot be empty")
		}
		if len(n) > 200 {
			n = n[:200]
		}
		in.Name = &n
	}
	if in.Icon != nil {
		v := strings.TrimSpace(*in.Icon)
		if len(v) > 16 {
			v = v[:16]
		}
		in.Icon = &v
	}
	if in.Instructions != nil {
		v := strings.TrimSpace(*in.Instructions)
		if len(v) > 8000 {
			v = v[:8000]
		}
		in.Instructions = &v
	}

	var sp Space
	err := s.db.Pool.QueryRow(ctx, `
        UPDATE spaces
        SET name         = COALESCE($3, name),
            description  = COALESCE($4, description),
            icon         = COALESCE($5, icon),
            instructions = COALESCE($6, instructions),
            updated_at   = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, name, COALESCE(description, ''), icon, instructions, created_at, updated_at,
                  (SELECT count(*) FROM space_files f WHERE f.space_id = id)
    `, spaceID, userID, in.Name, in.Description, in.Icon, in.Instructions).Scan(
		&sp.ID, &sp.Name, &sp.Description, &sp.Icon, &sp.Instructions,
		&sp.CreatedAt, &sp.UpdatedAt, &sp.FileCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("not found")
	}
	if err != nil {
		return nil, err
	}
	return &sp, nil
}

func (s *Service) Delete(ctx context.Context, userID, spaceID string) error {
	tag, err := s.db.Pool.Exec(ctx, `DELETE FROM spaces WHERE id = $1 AND user_id = $2`, spaceID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("not found")
	}
	return nil
}

func (s *Service) ListFiles(ctx context.Context, userID, spaceID string) ([]File, error) {
	rows, err := s.db.Pool.Query(ctx, `
        SELECT f.id, f.space_id, f.name, f.mime, f.size_bytes, COALESCE(f.md5, ''),
               (f.raw_text IS NOT NULL) AS has_text,
               (SELECT count(*) FROM space_chunks c WHERE c.file_id = f.id),
               f.created_at
        FROM space_files f
        JOIN spaces s ON s.id = f.space_id
        WHERE f.space_id = $1 AND s.user_id = $2
        ORDER BY f.created_at DESC
    `, spaceID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []File{}
	for rows.Next() {
		var f File
		if err := rows.Scan(&f.ID, &f.SpaceID, &f.Name, &f.Mime, &f.SizeBytes, &f.MD5, &f.HasText, &f.ChunkCount, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *Service) UploadFile(ctx context.Context, userID, spaceID, name, mime string, body []byte) (*File, error) {
	// Confirm the space belongs to this user before storing anything.
	// Ownership gate: Get returns pgx.ErrNoRows when the space doesn't
	// exist OR isn't owned by this user; the writeJSON helper maps
	// that to 404 so the caller never sees an IDOR fingerprint.
	if _, err := s.Get(ctx, userID, spaceID); err != nil {
		return nil, err
	}
	if len(body) == 0 {
		return nil, errors.New("empty file")
	}
	if len(body) > maxUploadBytes {
		return nil, fmt.Errorf("file too large (max %d bytes)", maxUploadBytes)
	}
	// Strip any path components from the supplied filename so a user
	// can't store "../../etc/passwd" — even though we never write to
	// disk, the name surfaces in UI / future download endpoints and
	// would let a malicious filename hijack a download dialog.
	name = sanitiseFilename(name)
	if name == "" {
		return nil, errors.New("invalid filename")
	}
	mime = sanitiseMime(mime)

	sum := md5.Sum(body)
	digest := hex.EncodeToString(sum[:])

	rawText := extractText(mime, name, body)

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	// Use a fresh context for rollback so a cancelled request ctx (client
	// disconnected mid-upload) doesn't leave the connection in a half-
	// broken state. pgx returns the connection to the pool only if the
	// rollback message actually goes through.
	defer func() {
		rbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(rbCtx)
	}()

	var f File
	err = tx.QueryRow(ctx, `
        INSERT INTO space_files (space_id, name, mime, size_bytes, md5, raw, raw_text)
        VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''))
        RETURNING id, space_id, name, mime, size_bytes, md5, created_at
    `, spaceID, name, mime, int64(len(body)), digest, body, rawText).Scan(
		&f.ID, &f.SpaceID, &f.Name, &f.Mime, &f.SizeBytes, &f.MD5, &f.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	f.HasText = rawText != ""

	if rawText != "" {
		chunks := chunk(rawText)
		f.ChunkCount = len(chunks)
		for i, c := range chunks {
			// to_tsvector('simple', $1) fails noisily on invalid UTF-8.
			// Coerce here so a misdetected binary file (extractText
			// picks up a .csv that's actually UTF-16) doesn't poison
			// the whole transaction.
			if !utf8.ValidString(c) {
				c = strings.ToValidUTF8(c, "�")
			}
			_, err := tx.Exec(ctx, `
                INSERT INTO space_chunks (file_id, space_id, idx, content)
                VALUES ($1, $2, $3, $4)
            `, f.ID, spaceID, i, c)
			if err != nil {
				return nil, err
			}
		}
	}

	// Bump the space's updated_at so it sorts to the top of the list.
	if _, err := tx.Exec(ctx, `UPDATE spaces SET updated_at = now() WHERE id = $1`, spaceID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &f, nil
}

func (s *Service) DeleteFile(ctx context.Context, userID, spaceID, fileID string) error {
	tag, err := s.db.Pool.Exec(ctx, `
        DELETE FROM space_files f
        USING spaces s
        WHERE f.id = $1 AND f.space_id = $2 AND f.space_id = s.id AND s.user_id = $3
    `, fileID, spaceID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("not found")
	}
	return nil
}

// Context returns up to maxContextHits chunks from the space that best match q.
// Uses Postgres FTS ranking. If the space has no indexable text, returns empty.
func (s *Service) Context(ctx context.Context, userID, spaceID, q string) ([]Chunk, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil, nil
	}
	// Ownership gate.
	// Ownership gate: Get returns pgx.ErrNoRows when the space doesn't
	// exist OR isn't owned by this user; the writeJSON helper maps
	// that to 404 so the caller never sees an IDOR fingerprint.
	if _, err := s.Get(ctx, userID, spaceID); err != nil {
		return nil, err
	}
	// plainto_tsquery is tolerant of free-form input (no need to escape).
	rows, err := s.db.Pool.Query(ctx, `
        SELECT c.id, c.file_id, f.name, c.idx, c.content,
               ts_rank(c.tsv, plainto_tsquery('simple', $2)) AS score
        FROM space_chunks c
        JOIN space_files f ON f.id = c.file_id
        WHERE c.space_id = $1
          AND c.tsv @@ plainto_tsquery('simple', $2)
        ORDER BY score DESC
        LIMIT $3
    `, spaceID, q, maxContextHits)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Chunk{}
	for rows.Next() {
		var c Chunk
		if err := rows.Scan(&c.ID, &c.FileID, &c.FileName, &c.Idx, &c.Content, &c.Score); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ─── HTTP layer ────────────────────────────────────────────────────────────

// Register wires the spaces routes. uploadLimit is an optional
// per-IP throttle around the multipart upload endpoint — pass nil to
// skip (the in-process default in main.go is 10-burst / 12/min sustained).
// File ingest does PDF parse + text chunking per call, so a script
// looping uploads at 100/s can starve CPU without it.
func (s *Service) Register(r chi.Router, uploadLimit func(http.Handler) http.Handler) {
	r.Route("/api/spaces", func(r chi.Router) {
		r.Use(s.auth.Required)
		r.Get("/", s.handleList)
		r.Post("/", s.handleCreate)
		r.Get("/{id}", s.handleGet)
		r.Patch("/{id}", s.handleUpdate)
		r.Delete("/{id}", s.handleDelete)
		r.Get("/{id}/files", s.handleListFiles)
		if uploadLimit != nil {
			r.With(uploadLimit).Post("/{id}/files", s.handleUpload)
		} else {
			r.Post("/{id}/files", s.handleUpload)
		}
		r.Delete("/{id}/files/{fileID}", s.handleDeleteFile)
		r.Get("/{id}/context", s.handleContext)
	})
}

func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	out, err := s.List(r.Context(), u.ID)
	writeJSON(w, out, err)
}

func (s *Service) handleCreate(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var in CreateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	sp, err := s.Create(r.Context(), u.ID, in)
	writeJSON(w, sp, err)
}

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	sp, err := s.Get(r.Context(), u.ID, chi.URLParam(r, "id"))
	writeJSON(w, sp, err)
}

func (s *Service) handleUpdate(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var in UpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	sp, err := s.Update(r.Context(), u.ID, chi.URLParam(r, "id"), in)
	writeJSON(w, sp, err)
}

func (s *Service) handleDelete(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if err := s.Delete(r.Context(), u.ID, chi.URLParam(r, "id")); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) handleListFiles(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	out, err := s.ListFiles(r.Context(), u.ID, chi.URLParam(r, "id"))
	writeJSON(w, out, err)
}

func (s *Service) handleUpload(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	spaceID := chi.URLParam(r, "id")
	// Wrap r.Body BEFORE ParseMultipartForm so a 100 GB multipart upload
	// can't spill the per-file overflow to disk. ParseMultipartForm's
	// own arg only caps RAM — files above that go to a temp file
	// without a global ceiling.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(maxUploadBytes + 1<<20); err != nil {
		http.Error(w, "bad form: "+err.Error(), http.StatusBadRequest)
		return
	}
	fh, hdr, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file field missing", http.StatusBadRequest)
		return
	}
	defer fh.Close()
	body, err := io.ReadAll(io.LimitReader(fh, maxUploadBytes+1))
	if err != nil {
		http.Error(w, "read: "+err.Error(), http.StatusBadRequest)
		return
	}
	// Detect "hit the limit" right here: io.LimitReader stops at N+1
	// returning a short read instead of an error, so without this check
	// the caller can push almost 11 MB before the inner UploadFile
	// re-checks at line 273.
	if len(body) > maxUploadBytes {
		http.Error(w, "file too large", http.StatusRequestEntityTooLarge)
		return
	}
	mime := hdr.Header.Get("Content-Type")
	if mime == "" {
		mime = "application/octet-stream"
	}
	out, err := s.UploadFile(r.Context(), u.ID, spaceID, hdr.Filename, mime, body)
	writeJSON(w, out, err)
}

func (s *Service) handleDeleteFile(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if err := s.DeleteFile(r.Context(), u.ID, chi.URLParam(r, "id"), chi.URLParam(r, "fileID")); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) handleContext(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	out, err := s.Context(r.Context(), u.ID, chi.URLParam(r, "id"), r.URL.Query().Get("q"))
	writeJSON(w, out, err)
}

// writeJSON serialises v or, when err != nil, picks an HTTP status code
// from the error shape. Previously every error became 400 — including
// lookups for missing resources and genuine DB outages — which confused
// callers and hid real failures. 5xx responses now return an opaque
// "internal error" body so pgx / SQLSTATE / file-path detail can't
// bleed through; the full text is logged server-side.
func writeJSON(w http.ResponseWriter, v any, err error) {
	if err != nil {
		code := httpStatusFromErr(err)
		if code >= 500 {
			log.Printf("spaces: %d %v", code, err)
			http.Error(w, "internal error", code)
			return
		}
		http.Error(w, err.Error(), code)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func httpStatusFromErr(err error) int {
	if err == nil {
		return http.StatusOK
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return http.StatusNotFound
	}
	s := err.Error()
	low := strings.ToLower(s)
	switch {
	case strings.Contains(low, "not found"), strings.Contains(low, "no such"):
		return http.StatusNotFound
	case strings.Contains(low, "forbidden"), strings.Contains(low, "not allowed"):
		return http.StatusForbidden
	case strings.Contains(low, "too large"), strings.Contains(low, "exceeds"):
		return http.StatusRequestEntityTooLarge
	case strings.Contains(low, "invalid"), strings.Contains(low, "required"):
		return http.StatusBadRequest
	case strings.Contains(low, "conflict"), strings.Contains(low, "exists"):
		return http.StatusConflict
	}
	// Unrecognised → 500. Genuine DB outages now surface correctly instead
	// of being mis-reported as 400s.
	return http.StatusInternalServerError
}

// ─── Text utilities ────────────────────────────────────────────────────────

// extractText returns plain text from `body` for supported MIMEs, or "" if the
// content isn't safely decodable as text. PDFs go through extractPDFText
// (ledongthuc/pdf, pure Go, no OCR). Office docs / scanned PDFs that
// the basic extractor can't read fall back to filename-only search.
func extractText(mime, name string, body []byte) string {
	mime = strings.ToLower(mime)
	// PDF: dedicated parser. Detected by MIME OR the magic "%PDF-" header
	// (browsers occasionally mis-label as application/octet-stream).
	if mime == "application/pdf" || strings.HasSuffix(strings.ToLower(name), ".pdf") || isPDFHeader(body) {
		return extractPDFText(body)
	}
	switch {
	case strings.HasPrefix(mime, "text/"),
		mime == "application/json",
		mime == "application/xml",
		mime == "application/csv",
		mime == "application/yaml" || mime == "application/x-yaml":
		// fall through
	default:
		// Fallback: sniff the bytes — if they're mostly printable ASCII/UTF-8
		// without NULs, treat as text. This catches .md, .log, .ini etc. that
		// browsers report as octet-stream.
		if !looksLikeText(body) {
			return ""
		}
	}
	// Trim to a sane upper bound so a 10 MB log doesn't explode the chunk count.
	const maxTextChars = 1_000_000
	s := string(body)
	if len(s) > maxTextChars {
		s = s[:maxTextChars]
	}
	return s
}

func looksLikeText(b []byte) bool {
	if len(b) == 0 {
		return false
	}
	probe := b
	if len(probe) > 2048 {
		probe = probe[:2048]
	}
	nonPrintable := 0
	for _, c := range probe {
		if c == 0 {
			return false
		}
		if c < 0x09 || (c > 0x0d && c < 0x20) {
			nonPrintable++
		}
	}
	return nonPrintable*100/len(probe) < 5
}

// chunk splits text into overlapping ~chunkChars windows broken on paragraph or
// sentence boundaries when possible. Returns at least one chunk for non-empty
// input.
func chunk(text string) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	if len(text) <= chunkChars {
		return []string{text}
	}
	var out []string
	pos := 0
	for pos < len(text) {
		end := pos + chunkChars
		if end >= len(text) {
			out = append(out, strings.TrimSpace(text[pos:]))
			break
		}
		// Prefer paragraph break inside last 100 chars, then sentence break.
		window := text[pos:end]
		split := strings.LastIndex(window, "\n\n")
		if split < chunkChars-200 {
			s := strings.LastIndexAny(window, ".!?\n")
			if s > chunkChars/2 {
				split = s + 1
			}
		}
		if split < chunkChars/2 {
			split = chunkChars
		}
		out = append(out, strings.TrimSpace(text[pos:pos+split]))
		// Guarantee forward progress: if the chosen split equals (or is
		// less than) chunkOverlap, pos won't advance and the loop spins
		// forever. The math above currently can't produce this, but a
		// future tweak to chunkOverlap or split's lower bound would —
		// and a silent infinite loop with allocations is much worse to
		// debug than a slightly-imperfect chunk boundary.
		step := split - chunkOverlap
		if step <= 0 {
			step = chunkChars / 2
		}
		pos += step
		if pos < 0 {
			pos = 0
		}
	}
	return out
}

// sanitiseFilename strips any path components from a user-supplied
// filename and clamps its length. Even though we don't write to disk
// (files live in bytea), the name is surfaced in UI and future
// download endpoints — a malicious "../../etc/passwd" would otherwise
// flow through to the Content-Disposition header on the download path
// and could trick a download dialog.
func sanitiseFilename(name string) string {
	name = strings.TrimSpace(name)
	// filepath.Base drops any directory traversal; ReplaceAll removes the
	// NUL bytes Windows would otherwise smuggle in via NTFS ADS.
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "\x00", "")
	// Drop ASCII control bytes and anything that would let a malicious
	// filename render as a script tag when shown in HTML.
	var b strings.Builder
	for _, r := range name {
		if r < 0x20 || r == 0x7f || r == '<' || r == '>' {
			continue
		}
		b.WriteRune(r)
	}
	out := b.String()
	if len(out) > 200 {
		out = out[:200]
	}
	// "" or "." or ".." are not valid filenames in any context.
	if out == "" || out == "." || out == ".." {
		return ""
	}
	return out
}

// sanitiseMime keeps only the type/subtype portion of a Content-Type
// header. Parameters (charset, boundary) are dropped because we never
// actually need them server-side and they widen the surface area for
// header smuggling when the value is later echoed back.
func sanitiseMime(mime string) string {
	mime = strings.TrimSpace(mime)
	if i := strings.IndexByte(mime, ';'); i >= 0 {
		mime = strings.TrimSpace(mime[:i])
	}
	// Allow only RFC 6838 type/subtype characters.
	for _, r := range mime {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' ||
			r == '/' || r == '+' || r == '-' || r == '.' {
			continue
		}
		return "application/octet-stream"
	}
	if mime == "" {
		return "application/octet-stream"
	}
	if len(mime) > 100 {
		return "application/octet-stream"
	}
	return mime
}

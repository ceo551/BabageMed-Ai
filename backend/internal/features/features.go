// Package features — per-user workspaces tied to the 8 fixed sidebar
// categories (Healthcare, Writing, Translation, Business, Financial,
// Consulting, Math-Science, Education). Each feature stores:
//   - custom instructions appended to the system prompt for that workflow
//   - selected skill ids (toggles from a curated catalog)
//   - selected connector ids (mcp servers used for grounding)
//   - uploaded files (raw blob + extracted text body for context lookup)
//
// Unlike Spaces, features are NOT user-created — they're 8 fixed slugs the
// product ships with. The HTTP handlers upsert on first GET so existing
// users get rows lazily and we don't need a data migration.
package features

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

const maxUploadBytes = 10 * 1024 * 1024 // 10 MB per file

// validSlugs is derived from the canonical ValidSlugs list (slugs.go)
// so this package, the chats package, and any future caller share one
// source of truth. Built once at init() so handlers stay branch-free.
var validSlugs = func() map[string]bool {
	m := make(map[string]bool, len(ValidSlugs))
	for _, s := range ValidSlugs {
		m[s] = true
	}
	return m
}()

type Feature struct {
	Slug         string    `json:"slug"`
	Instructions string    `json:"instructions"`
	Skills       []string  `json:"skills"`
	Connectors   []string  `json:"connectors"`
	Files        []File    `json:"files"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type File struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Mime      string    `json:"mime"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"createdAt"`
}

type UpdatePatch struct {
	Instructions *string  `json:"instructions,omitempty"`
	Skills       []string `json:"skills,omitempty"`
	Connectors   []string `json:"connectors,omitempty"`
}

type Service struct {
	db   *db.DB
	auth *auth.Service
}

func New(d *db.DB, a *auth.Service) *Service { return &Service{db: d, auth: a} }

func (s *Service) Register(r chi.Router) {
	r.Route("/api/features", func(r chi.Router) {
		r.Use(s.auth.Required)
		r.Get("/{slug}", s.handleGet)
		r.Patch("/{slug}", s.handlePatch)
		r.Post("/{slug}/files", s.handleUpload)
		r.Delete("/{slug}/files/{fileID}", s.handleDeleteFile)
	})
}

// ─── Persistence ───────────────────────────────────────────────────────────

// upsertRow guarantees a (user_id, slug) row exists before any GET/PATCH
// touches it. Called from every handler that needs to read or mutate.
func (s *Service) upsertRow(ctx context.Context, userID, slug string) error {
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO features (user_id, slug)
		VALUES ($1, $2)
		ON CONFLICT (user_id, slug) DO NOTHING
	`, userID, slug)
	return err
}

func (s *Service) get(ctx context.Context, userID, slug string) (*Feature, error) {
	if err := s.upsertRow(ctx, userID, slug); err != nil {
		return nil, err
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT instructions, skills, connectors, updated_at
		FROM features WHERE user_id = $1 AND slug = $2
	`, userID, slug)
	f := &Feature{Slug: slug, Skills: []string{}, Connectors: []string{}, Files: []File{}}
	var skillsJSON, connJSON []byte
	if err := row.Scan(&f.Instructions, &skillsJSON, &connJSON, &f.UpdatedAt); err != nil {
		return nil, err
	}
	if len(skillsJSON) > 0 { _ = json.Unmarshal(skillsJSON, &f.Skills) }
	if len(connJSON) > 0   { _ = json.Unmarshal(connJSON, &f.Connectors) }
	// Files list
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text, name, mime, size_bytes, created_at
		FROM feature_files
		WHERE user_id = $1 AND slug = $2
		ORDER BY created_at DESC
	`, userID, slug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var fi File
		if err := rows.Scan(&fi.ID, &fi.Name, &fi.Mime, &fi.Size, &fi.CreatedAt); err != nil {
			return nil, err
		}
		f.Files = append(f.Files, fi)
	}
	// pgx requires rows.Err() after the iterator returns false to catch
	// connection drops mid-result-set — without it, partial reads return
	// as a successful empty list.
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *Service) patch(ctx context.Context, userID, slug string, p UpdatePatch) (*Feature, error) {
	if err := s.upsertRow(ctx, userID, slug); err != nil {
		return nil, err
	}
	// Build dynamic SET clauses for only the fields the client sent.
	sets := []string{"updated_at = now()"}
	args := []any{userID, slug}
	i := 3
	if p.Instructions != nil {
		sets = append(sets, fmt.Sprintf("instructions = $%d", i))
		args = append(args, *p.Instructions)
		i++
	}
	if p.Skills != nil {
		b, _ := json.Marshal(p.Skills)
		sets = append(sets, fmt.Sprintf("skills = $%d", i))
		args = append(args, string(b))
		i++
	}
	if p.Connectors != nil {
		b, _ := json.Marshal(p.Connectors)
		sets = append(sets, fmt.Sprintf("connectors = $%d", i))
		args = append(args, string(b))
		i++
	}
	q := fmt.Sprintf("UPDATE features SET %s WHERE user_id = $1 AND slug = $2", strings.Join(sets, ", "))
	if _, err := s.db.Pool.Exec(ctx, q, args...); err != nil {
		return nil, err
	}
	return s.get(ctx, userID, slug)
}

func (s *Service) addFile(ctx context.Context, userID, slug, name, mime string, body []byte) (*Feature, error) {
	if err := s.upsertRow(ctx, userID, slug); err != nil {
		return nil, err
	}
	// Sanitise filename + mime before they hit the DB — see spaces
	// package for the same pattern. Without this, a malicious upload
	// could store "../../etc/passwd" or a Content-Type that smuggles
	// charset params we'd echo back unsafely.
	name = sanitiseUploadFilename(name)
	if name == "" {
		return nil, errors.New("invalid filename")
	}
	mime = sanitiseUploadMime(mime)
	sum := md5.Sum(body)
	hexSum := hex.EncodeToString(sum[:])
	// Text extraction: text/* and known text suffixes are read verbatim;
	// application/pdf goes through extractFeaturePDFText (ledongthuc/pdf,
	// pure Go). Anything else stores the raw bytes only — chat
	// grounding then falls back to filename-only search for that file.
	textBody := extractFeatureText(mime, name, body)
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO feature_files (user_id, slug, name, mime, size_bytes, md5, content, text_body)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, userID, slug, name, mime, len(body), hexSum, body, textBody)
	if err != nil {
		return nil, err
	}
	return s.get(ctx, userID, slug)
}

func (s *Service) removeFile(ctx context.Context, userID, slug, fileID string) (*Feature, error) {
	tag, err := s.db.Pool.Exec(ctx, `
		DELETE FROM feature_files
		WHERE user_id = $1 AND slug = $2 AND id::text = $3
	`, userID, slug, fileID)
	if err != nil {
		return nil, err
	}
	// Without this check, deleting a non-existent file returns the
	// unchanged feature blob and the client can't tell "deleted" from
	// "no-op" (helpful when retry-deleting from the UI is in flight).
	if tag.RowsAffected() == 0 {
		return nil, errors.New("file not found")
	}
	return s.get(ctx, userID, slug)
}

// ─── HTTP handlers ─────────────────────────────────────────────────────────

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !validSlugs[slug] { http.Error(w, "unknown feature", http.StatusNotFound); return }
	u := auth.FromContext(r.Context())
	f, err := s.get(r.Context(), u.ID, slug)
	writeJSON(w, f, err)
}

func (s *Service) handlePatch(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !validSlugs[slug] { http.Error(w, "unknown feature", http.StatusNotFound); return }
	var in UpdatePatch
	// Cap patch body at 256 KB. Custom instructions + a long list of
	// connector ids + skills shouldn't come close. Without the cap a
	// runaway client could spool unbounded into the JSON decoder.
	if err := json.NewDecoder(io.LimitReader(r.Body, 256<<10)).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	u := auth.FromContext(r.Context())
	f, err := s.patch(r.Context(), u.ID, slug, in)
	writeJSON(w, f, err)
}

func (s *Service) handleUpload(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !validSlugs[slug] { http.Error(w, "unknown feature", http.StatusNotFound); return }
	// MaxBytesReader caps the total body, including the temp-disk spill
	// path that ParseMultipartForm's `maxMemory` arg doesn't constrain.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, "upload too large", http.StatusRequestEntityTooLarge)
		return
	}
	u := auth.FromContext(r.Context())
	files := r.MultipartForm.File["file"]
	if len(files) == 0 {
		http.Error(w, "no file field", http.StatusBadRequest)
		return
	}
	var out *Feature
	for _, fh := range files {
		if fh.Size > maxUploadBytes {
			http.Error(w, "file too large", http.StatusRequestEntityTooLarge)
			return
		}
		f, err := fh.Open()
		if err != nil { http.Error(w, err.Error(), 500); return }
		body, err := io.ReadAll(io.LimitReader(f, maxUploadBytes+1))
		_ = f.Close()
		if err != nil { http.Error(w, err.Error(), 500); return }
		if int64(len(body)) > maxUploadBytes {
			http.Error(w, "file too large", http.StatusRequestEntityTooLarge); return
		}
		mime := fh.Header.Get("Content-Type")
		o, err := s.addFile(r.Context(), u.ID, slug, fh.Filename, mime, body)
		if err != nil { http.Error(w, err.Error(), 500); return }
		out = o
	}
	writeJSON(w, out, nil)
}

func (s *Service) handleDeleteFile(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !validSlugs[slug] { http.Error(w, "unknown feature", http.StatusNotFound); return }
	u := auth.FromContext(r.Context())
	f, err := s.removeFile(r.Context(), u.ID, slug, chi.URLParam(r, "fileID"))
	writeJSON(w, f, err)
}

// ─── helpers ───────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, v any, err error) {
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		code := 500
		low := strings.ToLower(err.Error())
		switch {
		case errors.Is(err, pgx.ErrNoRows), strings.Contains(low, "not found"):
			code = http.StatusNotFound
		case strings.Contains(low, "forbidden"):
			code = http.StatusForbidden
		case strings.Contains(low, "invalid"), strings.Contains(low, "required"):
			code = http.StatusBadRequest
		}
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	if v == nil {
		w.WriteHeader(204)
		return
	}
	_ = json.NewEncoder(w).Encode(v)
}

// silence unused-import warning when build tags exclude the rest
var _ = errors.New

// sanitiseUploadFilename mirrors spaces.sanitiseFilename — same threat
// model, same rules. Kept here to avoid a cross-package dependency
// just for two small helpers (and so an audit can confirm both
// packages enforce the same invariants by reading them side-by-side).
func sanitiseUploadFilename(name string) string {
	name = strings.TrimSpace(name)
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "\x00", "")
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
	if out == "" || out == "." || out == ".." {
		return ""
	}
	return out
}

func sanitiseUploadMime(mime string) string {
	mime = strings.TrimSpace(mime)
	if i := strings.IndexByte(mime, ';'); i >= 0 {
		mime = strings.TrimSpace(mime[:i])
	}
	for _, r := range mime {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' ||
			r == '/' || r == '+' || r == '-' || r == '.' {
			continue
		}
		return "application/octet-stream"
	}
	if mime == "" || len(mime) > 100 {
		return "application/octet-stream"
	}
	return mime
}

// Package chats — persistence layer for user chat conversations.
//
// Schema lives in 001_init.up.sql (chats + chat_messages tables already
// created). This package exposes the HTTP CRUD a logged-in user needs:
// list their chats, create new, append messages as they stream in, rename
// the title, delete a chat (which cascades to its messages).
package chats

import (
	"log"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/db"
	"github.com/pervagans/backend/internal/features"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type Chat struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Model     string    `json:"model"`
	Mode      string    `json:"mode"`
	// Feature is the slug of the feature page the chat was opened from
	// ("business", "writing", …) — empty string means a "general" chat
	// started from the dashboard root. The list endpoint partitions on
	// this so the general History sidebar row and each feature page's
	// sub-sidebar see disjoint sets.
	Feature   string    `json:"feature,omitempty"`
	// SpaceID is the Space this chat belongs to (empty for general/feature
	// chats). Surfaced so the space page can verify a ?c=<id> chat actually
	// belongs to the open space before loading it (cross-space guard).
	SpaceID   string    `json:"spaceId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Message struct {
	ID        string          `json:"id"`
	ChatID    string          `json:"chatId"`
	Role      string          `json:"role"`
	Content   string          `json:"content"`
	Citations json.RawMessage `json:"citations,omitempty"`
	Meta      json.RawMessage `json:"meta,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
}

type Service struct {
	db   *db.DB
	auth *auth.Service
}

func New(d *db.DB, a *auth.Service) *Service {
	return &Service{db: d, auth: a}
}

// ─── HTTP ──────────────────────────────────────────────────────────────────

func (s *Service) Register(r chi.Router) {
	r.Route("/api/chats", func(r chi.Router) {
		r.Use(s.auth.Required)
		r.Get("/", s.handleList)
		r.Post("/", s.handleCreate)
		r.Get("/{id}", s.handleGet)
		r.Patch("/{id}", s.handleUpdate)
		r.Delete("/{id}", s.handleDelete)
		r.Get("/{id}/messages", s.handleListMessages)
		r.Post("/{id}/messages", s.handleAppendMessage)
	})
}

// ─── List + create ────────────────────────────────────────────────────────

// handleList returns the user's chats. A ?feature=<slug> filter narrows
// to chats started inside that feature page; ?feature=general (or
// the alias "" via ?feature=) returns chats with NULL feature_slug,
// i.e. those started from the dashboard root.
func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	feature := r.URL.Query().Get("feature")
	space := r.URL.Query().Get("space")

	var (
		rows pgx.Rows
		err  error
	)
	// All list paths filter `deleted_at IS NULL` so soft-deleted chats stay
	// recoverable. A ?space=<uuid> filter returns that space's threads (shown
	// on the space page); feature=general now ALSO excludes space chats so
	// space threads never leak into the general sidebar history.
	switch {
	case space != "":
		if !looksLikeUUID(space) {
			writeJSON(w, []Chat{})
			return
		}
		rows, err = s.db.Pool.Query(r.Context(), `
			SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
			       COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
			FROM chats WHERE user_id = $1 AND deleted_at IS NULL AND space_id = $2::uuid
			ORDER BY updated_at DESC LIMIT 200
		`, u.ID, space)
	case feature == "":
		rows, err = s.db.Pool.Query(r.Context(), `
			SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
			       COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
			FROM chats WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY updated_at DESC LIMIT 200
		`, u.ID)
	case feature == "general":
		rows, err = s.db.Pool.Query(r.Context(), `
			SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
			       COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
			FROM chats WHERE user_id = $1 AND deleted_at IS NULL AND feature_slug IS NULL AND space_id IS NULL
			ORDER BY updated_at DESC LIMIT 200
		`, u.ID)
	default:
		rows, err = s.db.Pool.Query(r.Context(), `
			SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
			       COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
			FROM chats WHERE user_id = $1 AND deleted_at IS NULL AND feature_slug = $2
			ORDER BY updated_at DESC LIMIT 200
		`, u.ID, feature)
	}
	if err != nil {
		internalServerError(w, err)
		return
	}
	defer rows.Close()
	out := []Chat{}
	for rows.Next() {
		var c Chat
		if err := rows.Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.Feature, &c.SpaceID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			internalServerError(w, err)
			return
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		internalServerError(w, err)
		return
	}
	writeJSON(w, out)
}

func (s *Service) handleCreate(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var body struct {
		Title, Model, Mode, Feature string
		SpaceID                     string `json:"spaceId"`
	}
	if r.ContentLength != 0 {
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
	}
	body.Title = trimTitle(body.Title)
	// Feature whitelist mirrors backend/internal/features. Anything else
	// is treated as "no feature" (general chat). We don't 400 because
	// older clients may send empty strings or absent fields.
	if !validFeatureSlug(body.Feature) {
		body.Feature = ""
	}
	// A chat belongs to at most one space. Drop a malformed id rather than
	// 500 on the ::uuid cast; a space + a feature are mutually exclusive
	// in the UI, but storing both is harmless.
	if !looksLikeUUID(body.SpaceID) {
		body.SpaceID = ""
	}

	var c Chat
	err := s.db.Pool.QueryRow(r.Context(), `
		INSERT INTO chats (user_id, title, model, mode, feature_slug, space_id)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''),
		        (SELECT id FROM spaces WHERE id = NULLIF($6, '')::uuid AND user_id = $1))
		RETURNING id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
		          COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
	`, u.ID, body.Title, body.Model, body.Mode, body.Feature, body.SpaceID).
		Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.Feature, &c.SpaceID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		internalServerError(w, err)
		return
	}
	writeJSON(w, c)
}

// validFeatureSlug defers to internal/features so the chats package
// and the features package share one source of truth (see
// internal/features/slugs.go).
func validFeatureSlug(s string) bool {
	return features.IsValidSlug(s)
}

// looksLikeUUID is a cheap 8-4-4-4-12 hex shape check so a malformed space
// id is treated as "no space" instead of erroring the Postgres ::uuid cast.
func looksLikeUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// ─── Get + update + delete ────────────────────────────────────────────────

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var c Chat
	err := s.db.Pool.QueryRow(r.Context(), `
		SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
		       COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
		FROM chats WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, chi.URLParam(r, "id"), u.ID).Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.Feature, &c.SpaceID, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", 404)
		return
	}
	if err != nil {
		internalServerError(w, err)
		return
	}
	writeJSON(w, c)
}

func (s *Service) handleUpdate(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var patch struct{ Title, Model, Mode *string }
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&patch); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	if patch.Title != nil {
		t := trimTitle(*patch.Title)
		patch.Title = &t
	}
	var c Chat
	err := s.db.Pool.QueryRow(r.Context(), `
		UPDATE chats
		SET title      = COALESCE($3, title),
		    model      = COALESCE($4, model),
		    mode       = COALESCE($5, mode),
		    updated_at = now()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		RETURNING id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''),
		          COALESCE(feature_slug, ''), COALESCE(space_id::text, ''), created_at, updated_at
	`, chi.URLParam(r, "id"), u.ID, patch.Title, patch.Model, patch.Mode).
		Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.Feature, &c.SpaceID, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", 404)
		return
	}
	if err != nil {
		internalServerError(w, err)
		return
	}
	writeJSON(w, c)
}

func (s *Service) handleDelete(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	// Soft-delete by stamping deleted_at — preserves message history for
	// audit / GDPR-export / accidental-undo. The list and messages
	// queries filter on `deleted_at IS NULL` so the user sees the chat
	// disappear immediately. A future admin tool can hard-purge after
	// a retention window.
	tag, err := s.db.Pool.Exec(r.Context(),
		`UPDATE chats SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
		chi.URLParam(r, "id"), u.ID)
	if err != nil {
		internalServerError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "not found", 404)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Messages ─────────────────────────────────────────────────────────────

// Hard cap on /messages payload size. Without it, a chat with 50k
// messages streams every row into RAM and JSON-encodes them — single
// request can OOM the pod. 500 covers the deepest conversation a real
// user is likely to scroll; pagination via ?before=<id> is the path
// for full-history archival pulls.
const maxMessagesPerList = 500

func (s *Service) handleListMessages(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	// `before` cursor: ?before=<message-uuid> returns the page strictly
	// older than that message. Returns the most recent maxMessages
	// rows ordered ASC so the frontend can append on append.
	beforeID := r.URL.Query().Get("before")
	// A malformed cursor would otherwise blow up on the anchor.id ::uuid
	// comparison and surface a 500; reject it cleanly as a client bug.
	if beforeID != "" && !looksLikeUUID(beforeID) {
		http.Error(w, "invalid cursor", http.StatusBadRequest)
		return
	}
	chatID := chi.URLParam(r, "id")
	// Two SQL shapes so the planner uses the right index:
	//   - no cursor → newest N (DESC LIMIT) then we reverse to ASC
	//   - with cursor → newest N strictly older than the cursor
	var rows pgx.Rows
	var err error
	if beforeID == "" {
		rows, err = s.db.Pool.Query(r.Context(), `
			SELECT m.id, m.chat_id, m.role, m.content, m.citations, m.meta, m.created_at
			FROM chat_messages m
			JOIN chats c ON c.id = m.chat_id
			WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $3
		`, chatID, u.ID, maxMessagesPerList)
	} else {
		rows, err = s.db.Pool.Query(r.Context(), `
			SELECT m.id, m.chat_id, m.role, m.content, m.citations, m.meta, m.created_at
			FROM chat_messages m
			JOIN chats c ON c.id = m.chat_id
			JOIN chat_messages anchor ON anchor.id = $3 AND anchor.chat_id = c.id
			WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
			  AND (m.created_at, m.id) < (anchor.created_at, anchor.id)
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $4
		`, chatID, u.ID, beforeID, maxMessagesPerList)
	}
	if err != nil {
		internalServerError(w, err)
		return
	}
	defer rows.Close()
	out := []Message{}
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.Citations, &m.Meta, &m.CreatedAt); err != nil {
			internalServerError(w, err)
			return
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		internalServerError(w, err)
		return
	}
	// Caller expects ASC order for natural append; reverse the DESC
	// page before sending. In-place reverse is allocation-free.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	writeJSON(w, out)
}

func (s *Service) handleAppendMessage(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	chatID := chi.URLParam(r, "id")
	var body struct {
		Role      string          `json:"role"`
		Content   string          `json:"content"`
		Citations json.RawMessage `json:"citations,omitempty"`
		Meta      json.RawMessage `json:"meta,omitempty"`
	}
	// 4 MiB request body cap. A typed message + citations + meta should be
	// well under 1 MB; capping keeps a runaway client from spilling tens
	// of MB into Postgres on every persist.
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	if body.Role != "user" && body.Role != "assistant" && body.Role != "system" {
		http.Error(w, "invalid role", 400)
		return
	}
	// content_length cap: anything wildly larger than the request budget
	// indicates a client bug, not a legitimate message.
	const maxMessageContent = 3 * 1024 * 1024
	if len(body.Content) > maxMessageContent {
		http.Error(w, "message too large", http.StatusRequestEntityTooLarge)
		return
	}

	// Three-step write — ownership check, message INSERT, updated_at
	// bump — wrapped in a single transaction. Previously each ran as a
	// separate pool call, so a concurrent DELETE between the ownership
	// SELECT and the INSERT could land an orphaned message attempt (the
	// ON DELETE CASCADE saves it but the trailing UPDATE then targets a
	// vanished row, surfacing 500 errors at the user). Single TX with
	// the SELECT inside removes the race.
	tx, err := s.db.Pool.Begin(r.Context())
	if err != nil {
		internalServerError(w, err)
		return
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var owns bool
	if err := tx.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM chats WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)`,
		chatID, u.ID).Scan(&owns); err != nil {
		internalServerError(w, err)
		return
	}
	if !owns {
		http.Error(w, "not found", 404)
		return
	}

	var m Message
	err = tx.QueryRow(r.Context(), `
		INSERT INTO chat_messages (chat_id, role, content, citations, meta)
		VALUES ($1, $2, $3, COALESCE($4, '[]'::jsonb), COALESCE($5, '{}'::jsonb))
		RETURNING id, chat_id, role, content, citations, meta, created_at
	`, chatID, body.Role, body.Content, body.Citations, body.Meta).
		Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.Citations, &m.Meta, &m.CreatedAt)
	if err != nil {
		internalServerError(w, err)
		return
	}
	// Bump the chat's updated_at so it sorts to the top of the sidebar list.
	if _, err := tx.Exec(r.Context(),
		`UPDATE chats SET updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, chatID); err != nil {
		internalServerError(w, err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		internalServerError(w, err)
		return
	}
	writeJSON(w, m)
}

// ─── Helpers ──────────────────────────────────────────────────────────────

// trimTitle clamps the title to a sane width — first 80 chars, single line.
// Empty input is allowed (NULL in DB); a fallback "New chat" can be set by
// the frontend on display if it wants one.
func trimTitle(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > 80 {
		s = s[:80]
	}
	return s
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

var _ = context.Background // ensure import isn't dropped if the helpers shrink

// internalServerError logs the full error server-side and returns an opaque
// "internal error" body — keeps pgx / SQLSTATE / file paths from bleeding
// into client-visible responses (info-disclosure on every 500 site).
func internalServerError(w http.ResponseWriter, err error) {
	log.Printf("chats: 500 %v", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}

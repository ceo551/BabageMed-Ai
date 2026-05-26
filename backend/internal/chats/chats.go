// Package chats — persistence layer for user chat conversations.
//
// Schema lives in 001_init.up.sql (chats + chat_messages tables already
// created). This package exposes the HTTP CRUD a logged-in user needs:
// list their chats, create new, append messages as they stream in, rename
// the title, delete a chat (which cascades to its messages).
package chats

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type Chat struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Model     string    `json:"model"`
	Mode      string    `json:"mode"`
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

func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	rows, err := s.db.Pool.Query(r.Context(), `
		SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''), created_at, updated_at
		FROM chats WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT 200
	`, u.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()
	out := []Chat{}
	for rows.Next() {
		var c Chat
		if err := rows.Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.CreatedAt, &c.UpdatedAt); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		out = append(out, c)
	}
	writeJSON(w, out)
}

func (s *Service) handleCreate(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var body struct{ Title, Model, Mode string }
	// Don't swallow decode errors — an unparseable body usually means a
	// client bug and silently creating an empty-titled chat hides it.
	// An empty body is fine (typed as the zero value) so we only fail
	// when the body is non-empty AND malformed.
	if r.ContentLength != 0 {
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
	}
	body.Title = trimTitle(body.Title)

	var c Chat
	err := s.db.Pool.QueryRow(r.Context(), `
		INSERT INTO chats (user_id, title, model, mode)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''))
		RETURNING id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''), created_at, updated_at
	`, u.ID, body.Title, body.Model, body.Mode).Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, c)
}

// ─── Get + update + delete ────────────────────────────────────────────────

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var c Chat
	err := s.db.Pool.QueryRow(r.Context(), `
		SELECT id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''), created_at, updated_at
		FROM chats WHERE id = $1 AND user_id = $2
	`, chi.URLParam(r, "id"), u.ID).Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", 404)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, c)
}

func (s *Service) handleUpdate(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var patch struct{ Title, Model, Mode *string }
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
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
		WHERE id = $1 AND user_id = $2
		RETURNING id, COALESCE(title, ''), COALESCE(model, ''), COALESCE(mode, ''), created_at, updated_at
	`, chi.URLParam(r, "id"), u.ID, patch.Title, patch.Model, patch.Mode).
		Scan(&c.ID, &c.Title, &c.Model, &c.Mode, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", 404)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, c)
}

func (s *Service) handleDelete(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	tag, err := s.db.Pool.Exec(r.Context(), `DELETE FROM chats WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), u.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "not found", 404)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Messages ─────────────────────────────────────────────────────────────

func (s *Service) handleListMessages(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	// Ownership check via JOIN — saves a round-trip.
	rows, err := s.db.Pool.Query(r.Context(), `
		SELECT m.id, m.chat_id, m.role, m.content, m.citations, m.meta, m.created_at
		FROM chat_messages m
		JOIN chats c ON c.id = m.chat_id
		WHERE c.id = $1 AND c.user_id = $2
		ORDER BY m.created_at ASC, m.id ASC
	`, chi.URLParam(r, "id"), u.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()
	out := []Message{}
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.Citations, &m.Meta, &m.CreatedAt); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		out = append(out, m)
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

	// Verify ownership before inserting (RLS would be nicer; the JOIN here is
	// pragmatic for the current schema).
	var owns bool
	if err := s.db.Pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM chats WHERE id = $1 AND user_id = $2)`,
		chatID, u.ID).Scan(&owns); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if !owns {
		http.Error(w, "not found", 404)
		return
	}

	var m Message
	err := s.db.Pool.QueryRow(r.Context(), `
		INSERT INTO chat_messages (chat_id, role, content, citations, meta)
		VALUES ($1, $2, $3, COALESCE($4, '[]'::jsonb), COALESCE($5, '{}'::jsonb))
		RETURNING id, chat_id, role, content, citations, meta, created_at
	`, chatID, body.Role, body.Content, body.Citations, body.Meta).
		Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.Citations, &m.Meta, &m.CreatedAt)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	// Bump the chat's updated_at so it sorts to the top of the sidebar list.
	_, _ = s.db.Pool.Exec(r.Context(), `UPDATE chats SET updated_at = now() WHERE id = $1`, chatID)
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

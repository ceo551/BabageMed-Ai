// Package share — public, read-only snapshots of an assistant answer for the
// zero-login trial's viral loop (P4). "Share" stores {title, content,
// citations} and returns a short id; GET /api/share/{id} returns it with NO
// account (rendered at /s/{id}), and a "Remix in Pervagans" CTA bounces back
// into /try. Anonymous users may create shares (user_id nullable); abuse is
// bounded by an IP rate limiter (in main.go) + size caps here.
package share

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

const (
	maxShareContent = 100_000 // 100 KB of answer markdown
	maxShareTitle   = 300
)

// uuidRe guards the {id} path param so a malformed id returns 404 instead of a
// Postgres "invalid input syntax for type uuid" 500.
var uuidRe = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)

type Service struct {
	db *db.DB
}

func New(d *db.DB) *Service { return &Service{db: d} }

// Register wires the share routes. limiter is the per-IP throttle around the
// create endpoint (anonymous-writable). GET is public + unthrottled (cheap PK
// lookup) so a shared link survives a hug-of-death.
func (s *Service) Register(r chi.Router, limiter func(http.Handler) http.Handler) {
	if s == nil || s.db == nil {
		return
	}
	r.With(limiter).Post("/api/share", s.handleCreate)
	r.Get("/api/share/{id}", s.handleGet)
}

type createReq struct {
	Title     string          `json:"title"`
	Content   string          `json:"content"`
	Citations json.RawMessage `json:"citations"`
}

func (s *Service) handleCreate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	var in createReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	content := strings.TrimSpace(in.Content)
	if content == "" {
		http.Error(w, "content required", http.StatusBadRequest)
		return
	}
	if len(content) > maxShareContent {
		content = content[:maxShareContent]
	}
	title := strings.TrimSpace(in.Title)
	if len(title) > maxShareTitle {
		title = title[:maxShareTitle]
	}
	// Optional owner (a logged-in sharer); anonymous → NULL.
	var userID *string
	if u := auth.FromContext(r.Context()); u != nil {
		userID = &u.ID
	}
	// Pass citations through as JSONB only when it's valid JSON; else store NULL.
	var citations any
	if len(in.Citations) > 0 && json.Valid(in.Citations) {
		citations = string(in.Citations)
	}
	var id string
	err := s.db.Pool.QueryRow(r.Context(), `
        INSERT INTO shares (user_id, title, content, citations)
        VALUES ($1, NULLIF($2, ''), $3, $4::jsonb)
        RETURNING id::text
    `, userID, title, content, citations).Scan(&id)
	if err != nil {
		log.Printf("share: create %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"id": id})
}

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuidRe.MatchString(id) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var title, content string
	var citations []byte
	err := s.db.Pool.QueryRow(r.Context(), `
        SELECT COALESCE(title, ''), content, citations FROM shares WHERE id = $1
    `, id).Scan(&title, &content, &citations)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("share: get %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := map[string]any{"title": title, "content": content}
	if len(citations) > 0 {
		out["citations"] = json.RawMessage(citations)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

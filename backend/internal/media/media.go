// Package media — generation + durable persistence of AI images/videos.
//
// Generation is backed by Alibaba Model Studio / DashScope (see
// internal/llm/dashscope.go). DashScope returns an OSS URL that EXPIRES after a
// few hours, so we download the bytes and store them in Postgres (BYTEA, same
// pattern as space_files.raw) and serve them back via /api/media/{id}. This
// gives every result a durable URL + a per-user Gallery, and binds async video
// tasks to their owner (closing the cross-tenant poll IDOR).
package media

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/db"
	"github.com/pervagans/backend/internal/llm"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// maxAssetBytes caps a single stored asset (videos are the large case).
const maxAssetBytes = 30 << 20 // 30 MiB
const maxMediaPromptBytes = 4000
const maxBatch = 4

type Service struct {
	db   *db.DB
	auth *auth.Service
	llm  *llm.Client
	http *http.Client
}

func New(d *db.DB, a *auth.Service, l *llm.Client) *Service {
	return &Service{db: d, auth: a, llm: l, http: &http.Client{
		Timeout: 60 * time.Second,
		// Asset downloads hit a direct DashScope OSS URL — never follow a
		// redirect (defense against SSRF / redirect-to-internal).
		CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("redirect not allowed") },
	}}
}

var allowedImageModels = map[string]bool{
	"qwen-image-2.0-pro": true,
	"wan2.7-image-pro":   true,
}
var allowedVideoModels = map[string]bool{
	"happy-horse-1.0": true,
}

var aspectToImageSize = map[string]string{
	"1:1": "1024*1024", "16:9": "1280*720", "9:16": "720*1280", "4:3": "1024*768", "3:4": "768*1024",
}

func imageSizeForAspect(a string) string {
	if s, ok := aspectToImageSize[a]; ok {
		return s
	}
	return "1024*1024"
}
func videoSizeForAspect(a string) string {
	if a == "9:16" {
		return "720*1280"
	}
	return "1280*720"
}

// publicURL is the browser-usable path for an asset (through the Next proxy).
func publicURL(id string) string { return "/api/backend/api/media/" + id }

// ─── Routes ─────────────────────────────────────────────────────────────────

// Register wires the media routes. genMW is the tools rate-limiter applied to
// the (paid) generation endpoints; serve/list/delete only need auth.
func (s *Service) Register(r chi.Router, genMW func(http.Handler) http.Handler) {
	r.Group(func(gr chi.Router) {
		gr.Use(s.auth.Required)
		gr.Use(genMW)
		gr.Post("/api/generate/image", s.handleGenerateImage)
		gr.Post("/api/generate/video", s.handleSubmitVideo)
		gr.Get("/api/generate/video/{taskId}", s.handlePollVideo)
	})
	r.Group(func(gr chi.Router) {
		gr.Use(s.auth.Required)
		gr.Get("/api/media", s.handleListGallery)
		gr.Get("/api/media/{id}", s.handleServe)
		gr.Delete("/api/media/{id}", s.handleDelete)
	})
}

type mediaRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	NegativePrompt string `json:"negativePrompt"`
	Aspect         string `json:"aspect"`
	Seed           int    `json:"seed"`
	N              int    `json:"n"`
}

func decode(w http.ResponseWriter, r *http.Request) (mediaRequest, bool) {
	var req mediaRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return req, false
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		writeJSON(w, 400, map[string]string{"error": "prompt required"})
		return req, false
	}
	if len(req.Prompt) > maxMediaPromptBytes {
		req.Prompt = req.Prompt[:maxMediaPromptBytes]
	}
	req.NegativePrompt = strings.TrimSpace(req.NegativePrompt)
	if len(req.NegativePrompt) > maxMediaPromptBytes {
		req.NegativePrompt = req.NegativePrompt[:maxMediaPromptBytes]
	}
	if req.Seed < 0 {
		req.Seed = 0
	}
	return req, true
}

func paramsJSON(req mediaRequest) []byte {
	b, _ := json.Marshal(map[string]any{
		"aspect": req.Aspect, "seed": req.Seed, "negativePrompt": req.NegativePrompt,
	})
	return b
}

// ─── Image (sync) ─────────────────────────────────────────────────────────

func (s *Service) handleGenerateImage(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	req, ok := decode(w, r)
	if !ok {
		return
	}
	if !allowedImageModels[req.Model] {
		writeJSON(w, 400, map[string]string{"error": "unknown image model"})
		return
	}
	n := req.N
	if n < 1 {
		n = 1
	}
	if n > maxBatch {
		n = maxBatch
	}
	urls, err := s.llm.GenerateImage(r.Context(), req.Model, req.Prompt, llm.ImageOptions{
		NegativePrompt: req.NegativePrompt,
		Size:           imageSizeForAspect(req.Aspect),
		Seed:           req.Seed,
		N:              n,
	})
	if err != nil {
		log.Printf("media: image gen (%s) failed: %v", req.Model, err)
		writeJSON(w, 502, map[string]string{"error": "image generation failed"})
		return
	}
	params := paramsJSON(req)
	out := []string{}
	for _, src := range urls {
		b, mime, derr := s.download(r.Context(), src)
		if derr != nil {
			log.Printf("media: download generated image failed: %v", derr)
			continue
		}
		var id string
		err := s.db.Pool.QueryRow(r.Context(), `
			INSERT INTO media_assets (user_id, kind, model, prompt, params, status, mime, bytes, size_bytes)
			VALUES ($1, 'image', $2, $3, $4::jsonb, 'ready', $5, $6, $7)
			RETURNING id::text
		`, u.ID, req.Model, req.Prompt, string(params), mime, b, len(b)).Scan(&id)
		if err != nil {
			log.Printf("media: persist image failed: %v", err)
			continue
		}
		out = append(out, publicURL(id))
	}
	if len(out) == 0 {
		writeJSON(w, 502, map[string]string{"error": "image generation failed"})
		return
	}
	writeJSON(w, 200, map[string]any{"images": out})
}

// ─── Video (async + poll, owner-bound) ────────────────────────────────────

func (s *Service) handleSubmitVideo(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	req, ok := decode(w, r)
	if !ok {
		return
	}
	if !allowedVideoModels[req.Model] {
		writeJSON(w, 400, map[string]string{"error": "unknown video model"})
		return
	}
	taskID, err := s.llm.SubmitVideo(r.Context(), req.Model, req.Prompt, llm.VideoOptions{
		Size: videoSizeForAspect(req.Aspect),
	})
	if err != nil {
		log.Printf("media: video submit (%s) failed: %v", req.Model, err)
		writeJSON(w, 502, map[string]string{"error": "video generation failed"})
		return
	}
	// Bind the task to its owner so PollVideo can authorize by (task_id, user).
	// If this fails the task is unpollable, so surface an error rather than
	// returning a taskId that can never resolve (orphaned billed job).
	if _, ierr := s.db.Pool.Exec(r.Context(), `
		INSERT INTO media_assets (user_id, kind, model, prompt, params, task_id, status)
		VALUES ($1, 'video', $2, $3, $4::jsonb, $5, 'pending')
	`, u.ID, req.Model, req.Prompt, string(paramsJSON(req)), taskID); ierr != nil {
		log.Printf("media: bind video task (%s) failed: %v", taskID, ierr)
		writeJSON(w, 500, map[string]string{"error": "video generation failed"})
		return
	}
	writeJSON(w, 200, map[string]string{"taskId": taskID})
}

func (s *Service) handlePollVideo(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	taskID := chi.URLParam(r, "taskId")
	if taskID == "" {
		writeJSON(w, 400, map[string]string{"error": "task id required"})
		return
	}
	// Ownership gate — only the user who submitted the task can poll it.
	var id, status string
	err := s.db.Pool.QueryRow(r.Context(), `
		SELECT id::text, status FROM media_assets
		WHERE task_id = $1 AND user_id = $2 AND kind = 'video'
	`, taskID, u.ID).Scan(&id, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "internal error"})
		return
	}
	if status == "ready" {
		writeJSON(w, 200, map[string]string{"status": "SUCCEEDED", "url": publicURL(id)})
		return
	}
	if status == "failed" {
		writeJSON(w, 200, map[string]string{"status": "FAILED"})
		return
	}
	task, err := s.llm.PollVideo(r.Context(), taskID)
	if err != nil {
		log.Printf("media: video poll (%s) failed: %v", taskID, err)
		writeJSON(w, 502, map[string]string{"error": "video status check failed"})
		return
	}
	switch task.Status {
	case "SUCCEEDED":
		b, mime, derr := s.download(r.Context(), task.URL)
		if derr != nil {
			log.Printf("media: download generated video failed: %v", derr)
			writeJSON(w, 502, map[string]string{"error": "video fetch failed"})
			return
		}
		if _, uerr := s.db.Pool.Exec(r.Context(), `
			UPDATE media_assets SET bytes = $1, mime = $2, size_bytes = $3, status = 'ready'
			WHERE id = $4::uuid
		`, b, mime, len(b), id); uerr != nil {
			log.Printf("media: persist video failed: %v", uerr)
			writeJSON(w, 500, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, 200, map[string]string{"status": "SUCCEEDED", "url": publicURL(id)})
	case "FAILED":
		_, _ = s.db.Pool.Exec(r.Context(), `UPDATE media_assets SET status = 'failed' WHERE id = $1::uuid`, id)
		writeJSON(w, 200, map[string]string{"status": "FAILED"})
	default:
		writeJSON(w, 200, map[string]string{"status": task.Status})
	}
}

// ─── Serve + gallery ──────────────────────────────────────────────────────

func (s *Service) handleServe(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	if !looksLikeUUID(id) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var mime string
	var bytes []byte
	err := s.db.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(mime, 'application/octet-stream'), bytes
		FROM media_assets WHERE id = $1::uuid AND user_id = $2 AND bytes IS NOT NULL
	`, id, u.ID).Scan(&mime, &bytes)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(bytes)
}

type galleryItem struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	Kind      string `json:"kind"`
	Model     string `json:"model"`
	Prompt    string `json:"prompt"`
	CreatedAt string `json:"createdAt"`
}

func (s *Service) handleListGallery(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	rows, err := s.db.Pool.Query(r.Context(), `
		SELECT id::text, kind, model, COALESCE(prompt, ''), created_at
		FROM media_assets
		WHERE user_id = $1 AND status = 'ready'
		ORDER BY created_at DESC LIMIT 120
	`, u.ID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "internal error"})
		return
	}
	defer rows.Close()
	out := []galleryItem{}
	for rows.Next() {
		var it galleryItem
		var created time.Time
		if err := rows.Scan(&it.ID, &it.Kind, &it.Model, &it.Prompt, &created); err != nil {
			writeJSON(w, 500, map[string]string{"error": "internal error"})
			return
		}
		it.URL = publicURL(it.ID)
		it.CreatedAt = created.UTC().Format(time.RFC3339)
		out = append(out, it)
	}
	writeJSON(w, 200, out)
}

func (s *Service) handleDelete(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	if !looksLikeUUID(id) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	tag, err := s.db.Pool.Exec(r.Context(), `DELETE FROM media_assets WHERE id = $1::uuid AND user_id = $2`, id, u.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Helpers ──────────────────────────────────────────────────────────────

// download fetches a generated asset's bytes from the (short-lived) upstream
// URL, capped so a single asset can't blow memory.
func (s *Service) download(ctx context.Context, rawURL string) ([]byte, string, error) {
	// SSRF guard: only fetch https DashScope OSS URLs. The URL comes from the
	// upstream response, but validating defends against a manipulated/poisoned
	// response pointing the server-side fetch at an internal address.
	if u, perr := neturl.Parse(rawURL); perr != nil || u.Scheme != "https" || !strings.HasSuffix(strings.ToLower(u.Hostname()), "aliyuncs.com") {
		return nil, "", errors.New("refusing to fetch non-DashScope asset URL")
	}
	req, err := http.NewRequestWithContext(ctx, "GET", rawURL, nil)
	if err != nil {
		return nil, "", err
	}
	res, err := s.http.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return nil, "", fmt.Errorf("download: %s", res.Status)
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, maxAssetBytes+1))
	if err != nil {
		return nil, "", err
	}
	if len(b) > maxAssetBytes {
		return nil, "", errors.New("asset too large")
	}
	mime := res.Header.Get("Content-Type")
	if mime == "" {
		mime = "application/octet-stream"
	}
	return b, mime, nil
}

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

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

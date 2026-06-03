package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Media generation endpoints backed by Alibaba Model Studio / DashScope
// (see internal/llm/dashscope.go):
//
//   POST /api/generate/image          → { url }            (synchronous)
//   POST /api/generate/video          → { taskId }         (async kick-off)
//   GET  /api/generate/video/{taskId} → { status, url }    (client polls)
//
// The allow-lists below MUST stay in sync with apps/web/app/lib/models.ts and
// the dashScope*ModelMap tables in the llm package — a request for any other
// model id is rejected up-front so a caller can't probe arbitrary upstream
// model codes through us.

const maxMediaPromptBytes = 4000

type mediaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

var allowedImageModels = map[string]bool{
	"qwen-image-2.0-pro": true,
	"wan2.7-image-pro":   true,
}

var allowedVideoModels = map[string]bool{
	"happy-horse-1.0": true,
}

// decodeMediaRequest reads + validates the shared {model, prompt} body. It
// writes the error response itself and returns ok=false on failure.
func (h *Handler) decodeMediaRequest(w http.ResponseWriter, r *http.Request) (mediaRequest, bool) {
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
	return req, true
}

// GenerateImage renders an image synchronously and returns its URL.
func (h *Handler) GenerateImage(w http.ResponseWriter, r *http.Request) {
	req, ok := h.decodeMediaRequest(w, r)
	if !ok {
		return
	}
	if !allowedImageModels[req.Model] {
		writeJSON(w, 400, map[string]string{"error": "unknown image model"})
		return
	}
	url, err := h.llm.GenerateImage(r.Context(), req.Model, req.Prompt)
	if err != nil {
		// Log the upstream detail server-side; return an opaque message so
		// DashScope error bodies / request ids don't leak to the client.
		log.Printf("media: image gen (%s) failed: %v", req.Model, err)
		writeJSON(w, 502, map[string]string{"error": "image generation failed"})
		return
	}
	writeJSON(w, 200, map[string]string{"url": url})
}

// SubmitVideo kicks off an async video job and returns the task id to poll.
func (h *Handler) SubmitVideo(w http.ResponseWriter, r *http.Request) {
	req, ok := h.decodeMediaRequest(w, r)
	if !ok {
		return
	}
	if !allowedVideoModels[req.Model] {
		writeJSON(w, 400, map[string]string{"error": "unknown video model"})
		return
	}
	taskID, err := h.llm.SubmitVideo(r.Context(), req.Model, req.Prompt)
	if err != nil {
		log.Printf("media: video submit (%s) failed: %v", req.Model, err)
		writeJSON(w, 502, map[string]string{"error": "video generation failed"})
		return
	}
	writeJSON(w, 200, map[string]string{"taskId": taskID})
}

// PollVideo returns the current state of an async video task. status is one of
// PENDING / RUNNING / SUCCEEDED / FAILED; url is set only on SUCCEEDED.
func (h *Handler) PollVideo(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "taskId")
	if taskID == "" {
		writeJSON(w, 400, map[string]string{"error": "task id required"})
		return
	}
	task, err := h.llm.PollVideo(r.Context(), taskID)
	if err != nil {
		log.Printf("media: video poll (%s) failed: %v", taskID, err)
		writeJSON(w, 502, map[string]string{"error": "video status check failed"})
		return
	}
	writeJSON(w, 200, map[string]string{"status": task.Status, "url": task.URL})
}

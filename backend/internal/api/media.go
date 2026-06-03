package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/pervagans/backend/internal/llm"
	"github.com/go-chi/chi/v5"
)

// Media generation endpoints backed by Alibaba Model Studio / DashScope
// (see internal/llm/dashscope.go):
//
//   POST /api/generate/image          → { images: [url...] }   (synchronous, 1..4)
//   POST /api/generate/video          → { taskId }             (async kick-off)
//   GET  /api/generate/video/{taskId} → { status, url }        (client polls)
//
// The allow-lists below MUST stay in sync with apps/web/app/lib/models.ts and
// the dashScope*ModelMap tables in the llm package — a request for any other
// model id is rejected up-front so a caller can't probe arbitrary upstream
// model codes through us.

const maxMediaPromptBytes = 4000

// maxBatch caps how many images one request can ask for — each is a billed
// DashScope render, so we bound fan-out per call (the route is also auth-gated
// + tools-rate-limited).
const maxBatch = 4

type mediaRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	NegativePrompt string `json:"negativePrompt"`
	Aspect         string `json:"aspect"` // "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
	Seed           int    `json:"seed"`
	N              int    `json:"n"`
}

var allowedImageModels = map[string]bool{
	"qwen-image-2.0-pro": true,
	"wan2.7-image-pro":   true,
}

var allowedVideoModels = map[string]bool{
	"happy-horse-1.0": true,
}

// aspectToImageSize maps a UI aspect preset to a DashScope "<w>*<h>" size.
// Server-side allow-list so a client can't push an arbitrary/abusive size.
var aspectToImageSize = map[string]string{
	"1:1":  "1024*1024",
	"16:9": "1280*720",
	"9:16": "720*1280",
	"4:3":  "1024*768",
	"3:4":  "768*1024",
}

func imageSizeForAspect(a string) string {
	if s, ok := aspectToImageSize[a]; ok {
		return s
	}
	return "1024*1024"
}

// videoSizeForAspect — video models support fewer sizes; default 16:9 720p.
func videoSizeForAspect(a string) string {
	if a == "9:16" {
		return "720*1280"
	}
	return "1280*720"
}

// decodeMediaRequest reads + validates the shared body. It writes the error
// response itself and returns ok=false on failure.
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
	req.NegativePrompt = strings.TrimSpace(req.NegativePrompt)
	if len(req.NegativePrompt) > maxMediaPromptBytes {
		req.NegativePrompt = req.NegativePrompt[:maxMediaPromptBytes]
	}
	if req.Seed < 0 {
		req.Seed = 0
	}
	return req, true
}

// GenerateImage renders 1..N images synchronously and returns their URLs.
func (h *Handler) GenerateImage(w http.ResponseWriter, r *http.Request) {
	req, ok := h.decodeMediaRequest(w, r)
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
	urls, err := h.llm.GenerateImage(r.Context(), req.Model, req.Prompt, llm.ImageOptions{
		NegativePrompt: req.NegativePrompt,
		Size:           imageSizeForAspect(req.Aspect),
		Seed:           req.Seed,
		N:              n,
	})
	if err != nil {
		// Log the upstream detail server-side; return an opaque message so
		// DashScope error bodies / request ids don't leak to the client.
		log.Printf("media: image gen (%s) failed: %v", req.Model, err)
		writeJSON(w, 502, map[string]string{"error": "image generation failed"})
		return
	}
	writeJSON(w, 200, map[string]any{"images": urls})
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
	taskID, err := h.llm.SubmitVideo(r.Context(), req.Model, req.Prompt, llm.VideoOptions{
		Size: videoSizeForAspect(req.Aspect),
	})
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

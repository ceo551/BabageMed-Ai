package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/babagemed/backend/internal/llm"
	"github.com/babagemed/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	reg *mcp.Registry
	llm *llm.Client
}

func NewHandler(reg *mcp.Registry, l *llm.Client) *Handler {
	return &Handler{reg: reg, llm: l}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	writeJSON(w, 200, map[string]any{
		"ok":   true,
		"time": time.Now().UTC(),
		"mcps": h.reg.Health(ctx),
	})
}

func (h *Handler) ListServers(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"servers": h.reg.Servers()})
}

func (h *Handler) GetServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, ok := h.reg.Get(id)
	if !ok {
		http.Error(w, "not found", 404)
		return
	}
	writeJSON(w, 200, s)
}

func (h *Handler) ListTools(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	out, err := h.reg.ListTools(r.Context(), id)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, out)
}

func (h *Handler) CallTool(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tool := chi.URLParam(r, "tool")
	body, _ := io.ReadAll(r.Body)
	var args any
	if len(body) > 0 {
		if err := json.Unmarshal(body, &args); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid json: " + err.Error()})
			return
		}
	}
	out, err := h.reg.Call(r.Context(), id, tool, args)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, out)
}

type chatRequest struct {
	Model    string        `json:"model"`
	Mode     string        `json:"mode"`
	Locale   string        `json:"locale"`
	Messages []llm.Message `json:"messages"`
	UseMcps  []string      `json:"useMcps"`
}

func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	res, err := h.run(r.Context(), req)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, res)
}

func (h *Handler) ChatStream(w http.ResponseWriter, r *http.Request) {
	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flush, _ := w.(http.Flusher)
	send := func(event string, data any) {
		b, _ := json.Marshal(data)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(b))
		if flush != nil {
			flush.Flush()
		}
	}

	send("status", map[string]string{"phase": "retrieval"})
	citations, _ := h.gather(r.Context(), req)
	send("citations", citations)
	send("status", map[string]string{"phase": "reasoning"})
	res, err := h.complete(r.Context(), req, citations)
	if err != nil {
		send("error", map[string]string{"error": err.Error()})
		return
	}
	send("content", res)
	send("done", map[string]bool{"done": true})
}

func (h *Handler) run(ctx context.Context, req chatRequest) (map[string]any, error) {
	citations, _ := h.gather(ctx, req)
	res, err := h.complete(ctx, req, citations)
	if err != nil {
		return nil, err
	}
	return map[string]any{"completion": res, "citations": citations}, nil
}

func (h *Handler) gather(ctx context.Context, req chatRequest) ([]map[string]any, error) {
	if len(req.UseMcps) == 0 || len(req.Messages) == 0 {
		return nil, nil
	}
	last := req.Messages[len(req.Messages)-1].Content
	out := []map[string]any{}
	for _, id := range req.UseMcps {
		ctxT, cancel := context.WithTimeout(ctx, 25*time.Second)
		res, err := h.reg.Call(ctxT, id, "search", map[string]string{"query": last})
		cancel()
		if err != nil {
			continue
		}
		out = append(out, map[string]any{"source": id, "result": res})
	}
	return out, nil
}

func (h *Handler) complete(ctx context.Context, req chatRequest, citations []map[string]any) (*llm.CompletionResponse, error) {
	system := buildSystem(req.Mode, req.Locale, citations)
	if req.Model == "" {
		req.Model = "opus-4.7"
	}
	if len(req.Messages) == 0 {
		return nil, errors.New("messages required")
	}
	return h.llm.Complete(ctx, llm.CompletionRequest{
		Model:    req.Model,
		Mode:     req.Mode,
		Messages: req.Messages,
		System:   system,
	})
}

func buildSystem(mode, locale string, citations []map[string]any) string {
	var b strings.Builder
	b.WriteString("You are BabageMed AI — a HIPAA-aware clinician-in-the-loop assistant. Always cite primary sources, surface uncertainty, and never give a binding diagnosis.\n")
	if locale == "ar" {
		b.WriteString("If the user writes in Arabic, respond in Arabic, but keep drug names, doses, ICD codes, and citations in English.\n")
	}
	switch mode {
	case "deep":
		b.WriteString("Mode: deep reasoning. Take your time and reason rigorously before answering.\n")
	case "cited":
		b.WriteString("Mode: cite mode. Every clinical claim must reference a specific source from the retrieval block.\n")
	default:
		b.WriteString("Mode: bedside-fast. Concise, structured, actionable.\n")
	}
	if len(citations) > 0 {
		b.WriteString("\nRetrieved context (from connected MCP servers):\n")
		for _, c := range citations {
			j, _ := json.Marshal(c)
			b.Write(j)
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

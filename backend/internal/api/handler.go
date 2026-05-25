package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/babagemed/backend/internal/cache"
	"github.com/babagemed/backend/internal/llm"
	"github.com/babagemed/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

type Handler struct {
	reg   *mcp.Registry
	llm   *llm.Client
	cache *cache.Cache
}

func NewHandler(reg *mcp.Registry, l *llm.Client, c *cache.Cache) *Handler {
	return &Handler{reg: reg, llm: l, cache: c}
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
	// Optional pre-fetched chunks from a Space — frontend hits
	// /api/spaces/:id/context?q=… and passes the rows verbatim. Each item is
	// typically {fileName, idx, content, score}.
	SpaceContext []map[string]any `json:"spaceContext,omitempty"`
	// Optional name of the space the chunks come from — purely for the
	// system-prompt header so the model knows what corpus it's reading.
	SpaceName string `json:"spaceName,omitempty"`
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
	ctx := r.Context()
	// send returns false once the client has gone away (context cancelled or
	// the writer errored). Earlier this function ignored both signals, so a
	// browser tab close mid-stream left the provider goroutine churning out
	// deltas into a dead socket. The flusher's Flush() call itself doesn't
	// surface a disconnect, but ctx.Err() does (chi's Timeout middleware
	// cancels the request context when the client TCP connection closes).
	send := func(event string, data any) bool {
		if ctx.Err() != nil {
			return false
		}
		b, _ := json.Marshal(data)
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(b)); err != nil {
			return false
		}
		if flush != nil {
			flush.Flush()
		}
		return true
	}

	send("status", map[string]string{"phase": "retrieval"})
	citations, _ := h.gather(ctx, req)
	if !send("citations", citations) {
		return
	}
	send("status", map[string]string{"phase": "reasoning"})

	// Real provider streaming: forward each text delta as a 'delta' SSE event
	// so the frontend types in tokens as they arrive instead of waiting on a
	// single 'content' chunk at the end.
	system := buildSystem(req.Mode, req.Locale, citations, req.SpaceContext, req.SpaceName)
	if req.Model == "" {
		req.Model = "opus-4.7"
	}
	if len(req.Messages) == 0 {
		send("error", map[string]string{"error": "messages required"})
		return
	}
	res, err := h.llm.CompleteStream(ctx, llm.CompletionRequest{
		Model:    req.Model,
		Mode:     req.Mode,
		Messages: req.Messages,
		System:   system,
	}, func(delta string) {
		// If the client has disconnected the delta callback becomes a no-op;
		// CompleteStream's upstream HTTP call will be cancelled by ctx soon
		// after, so we don't burn CPU formatting unsent events.
		send("delta", map[string]string{"text": delta})
	})
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		send("error", map[string]string{"error": err.Error()})
		return
	}
	// Final 'content' carries the full text + provider/model metadata so the
	// frontend can persist the canonical version (the per-token deltas may
	// have arrived split across paragraph boundaries etc.).
	send("content", res)
	send("done", map[string]bool{"done": true})
}

func (h *Handler) run(ctx context.Context, req chatRequest) (map[string]any, error) {
	citations, _ := h.gather(ctx, req)
	res, err := h.complete(ctx, req, citations)
	if err != nil {
		return nil, err
	}
	out := map[string]any{"completion": res, "citations": citations}
	if len(req.SpaceContext) > 0 {
		out["spaceContext"] = req.SpaceContext
	}
	return out, nil
}

func (h *Handler) gather(ctx context.Context, req chatRequest) ([]map[string]any, error) {
	if len(req.UseMcps) == 0 || len(req.Messages) == 0 {
		return nil, nil
	}
	last := req.Messages[len(req.Messages)-1].Content

	// Fan out to all selected MCPs in parallel. Previously this was a serial
	// loop with a 25s per-call timeout, so 3+ selected MCPs would blow past
	// the 60s router timeout (middleware.Timeout in main.go) and the whole
	// chat request would 504. errgroup with SetLimit caps the fan-out so a
	// pathological case (every connector enabled) doesn't open hundreds of
	// outbound HTTP connections at once.
	type result struct {
		idx    int
		source string
		value  any
	}
	results := make([]result, len(req.UseMcps))
	var mu sync.Mutex // guards the results slice writes
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(8)
	for i, id := range req.UseMcps {
		i, id := i, id
		g.Go(func() error {
			cacheKey := "mcp:search:" + id + ":" + last
			var cached any
			if h.cache != nil && h.cache.GetJSON(gctx, cacheKey, &cached) {
				mu.Lock()
				results[i] = result{idx: i, source: id, value: cached}
				mu.Unlock()
				return nil
			}
			ctxT, cancel := context.WithTimeout(gctx, 25*time.Second)
			defer cancel()
			res, err := h.reg.Call(ctxT, id, "search", map[string]string{"query": last})
			if err != nil {
				// Per-MCP failures are non-fatal — the chat still proceeds
				// without that source. nil-valued result is the sentinel.
				return nil
			}
			if h.cache != nil {
				h.cache.SetJSON(ctx, cacheKey, res, 5*time.Minute)
			}
			mu.Lock()
			results[i] = result{idx: i, source: id, value: res}
			mu.Unlock()
			return nil
		})
	}
	// errgroup never returns an error here (every g.Go returns nil), but wait
	// to make sure all goroutines have finished before we read results.
	_ = g.Wait()

	out := make([]map[string]any, 0, len(results))
	for _, r := range results {
		if r.value == nil {
			continue
		}
		out = append(out, map[string]any{"source": r.source, "result": r.value})
	}
	return out, nil
}

func (h *Handler) complete(ctx context.Context, req chatRequest, citations []map[string]any) (*llm.CompletionResponse, error) {
	system := buildSystem(req.Mode, req.Locale, citations, req.SpaceContext, req.SpaceName)
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

func buildSystem(mode, locale string, citations []map[string]any, spaceCtx []map[string]any, spaceName string) string {
	var b strings.Builder
	b.WriteString("You are BabageMed AI — a HIPAA-aware clinician-in-the-loop assistant. Always cite primary sources, surface uncertainty, and never give a binding diagnosis.\n")
	// Inject the current server-side date so the model doesn't fall back on
	// its training-time best guess (the observed bug: Gemini answering
	// 2024-05-23 when asked the date in 2026). Includes day-of-week + UTC
	// offset hint so questions like "متى ميعاد الموعد التالي" don't drift.
	now := time.Now().UTC()
	fmt.Fprintf(&b, "Today is %s (UTC). Trust this date over anything in your training data; never invent a different year.\n",
		now.Format("Monday, January 2, 2006"))
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
	if len(spaceCtx) > 0 {
		if spaceName != "" {
			fmt.Fprintf(&b, "\nUser's space \"%s\" — relevant excerpts from uploaded files:\n", spaceName)
		} else {
			b.WriteString("\nUser's space — relevant excerpts from uploaded files:\n")
		}
		for _, c := range spaceCtx {
			j, _ := json.Marshal(c)
			b.Write(j)
			b.WriteByte('\n')
		}
		b.WriteString("Prefer these user-provided excerpts when they overlap with general knowledge; the user has uploaded them for a reason.\n")
	}
	return b.String()
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

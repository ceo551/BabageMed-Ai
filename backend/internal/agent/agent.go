// Package agent — Agent Mode: a bounded plan→act→deliver loop over the MCP
// connector fleet. The model is given the user's connected MCPs as function
// tools; it decides which to call, the backend executes them via the registry,
// feeds results back, and loops (capped) until the model writes a final answer.
// Progress streams to the client as SSE "step" events so the user watches the
// agent work — Manus/agent-mode wedge, on Pervagans' own tool layer.
package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/llm"
	"github.com/pervagans/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
)

const (
	maxIters    = 5    // plan/act rounds before we force a final answer
	maxTools    = 8    // distinct connectors exposed to the model per run
	maxObsChars = 3000 // cap each tool observation fed back into the context
	agentModel  = "qwen-3.7-max"
)

type Service struct {
	llm  *llm.Client
	reg  *mcp.Registry
	auth *auth.Service
}

func New(l *llm.Client, r *mcp.Registry, a *auth.Service) *Service {
	return &Service{llm: l, reg: r, auth: a}
}

func (s *Service) Register(r chi.Router, limiter func(http.Handler) http.Handler) {
	r.Group(func(gr chi.Router) {
		gr.Use(s.auth.Required)
		gr.Use(limiter)
		gr.Post("/api/agent/stream", s.handleStream)
	})
}

type agentReq struct {
	Task    string   `json:"task"`
	UseMcps []string `json:"useMcps"`
	Locale  string   `json:"locale"`
}

func (s *Service) handleStream(w http.ResponseWriter, r *http.Request) {
	var req agentReq
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONErr(w, 400, "invalid json")
		return
	}
	req.Task = strings.TrimSpace(req.Task)
	if req.Task == "" {
		writeJSONErr(w, 400, "task required")
		return
	}
	if len(req.Task) > 8000 {
		req.Task = req.Task[:8000]
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flush, _ := w.(http.Flusher)
	ctx := r.Context()
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

	// Expose the user's connected MCPs (capped) as function tools.
	tools, toolToID := s.buildTools(req.UseMcps)
	send("status", map[string]any{"phase": "planning", "tools": len(tools)})

	messages := []map[string]any{
		{"role": "system", "content": agentSystemPrompt(req.Locale, len(tools))},
		{"role": "user", "content": req.Task},
	}

	for iter := 0; iter < maxIters; iter++ {
		content, calls, err := s.llm.ChatWithTools(ctx, agentModel, messages, tools)
		if err != nil {
			log.Printf("agent: round %d failed: %v", iter, err)
			send("error", map[string]any{"error": "agent step failed"})
			send("done", map[string]any{})
			return
		}
		if len(calls) == 0 {
			// No more tools requested → this is the final answer.
			send("answer", map[string]any{"content": content})
			send("done", map[string]any{})
			return
		}
		// Record the assistant's tool-call turn so the tool results correlate.
		tcArr := make([]map[string]any, 0, len(calls))
		for _, tc := range calls {
			tcArr = append(tcArr, map[string]any{
				"id": tc.ID, "type": "function",
				"function": map[string]any{"name": tc.Name, "arguments": tc.Arguments},
			})
		}
		messages = append(messages, map[string]any{"role": "assistant", "content": content, "tool_calls": tcArr})

		for _, tc := range calls {
			query := extractQuery(tc.Arguments)
			send("step", map[string]any{"phase": "action", "tool": tc.Name, "query": query})
			obs := s.execTool(ctx, toolToID, tc)
			ok := !strings.HasPrefix(obs, "tool error")
			send("step", map[string]any{"phase": "observation", "tool": tc.Name, "ok": ok})
			messages = append(messages, map[string]any{
				"role": "tool", "tool_call_id": tc.ID, "content": obs,
			})
		}
	}

	// Hit the iteration cap — ask once more for a final synthesis with no tools.
	messages = append(messages, map[string]any{
		"role": "user",
		"content": "Stop calling tools now and write your best final answer from what you've gathered, citing connectors by name.",
	})
	content, _, err := s.llm.ChatWithTools(ctx, agentModel, messages, nil)
	if err != nil {
		send("error", map[string]any{"error": "agent synthesis failed"})
	} else {
		send("answer", map[string]any{"content": content})
	}
	send("done", map[string]any{})
}

// buildTools turns the user's connected MCP ids into function tools (only those
// that exist + declare a "search" tool), capped. Returns the tool defs and a
// map from tool name back to the mcp id.
func (s *Service) buildTools(useMcps []string) ([]llm.ToolDef, map[string]string) {
	tools := []llm.ToolDef{}
	toolToID := map[string]string{}
	seen := map[string]bool{}
	for _, id := range useMcps {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] || !validToolName(id) {
			continue
		}
		srv, ok := s.reg.Get(id)
		if !ok || !serverHasSearch(srv) {
			continue
		}
		seen[id] = true
		desc := srv.Name
		if srv.Category != "" {
			desc += " — " + srv.Category
		}
		tools = append(tools, llm.ToolDef{
			Name:        id,
			Description:  "Search " + desc,
			Parameters: map[string]any{
				"type":       "object",
				"properties": map[string]any{"query": map[string]any{"type": "string", "description": "search query"}},
				"required":   []string{"query"},
			},
		})
		toolToID[id] = id
		if len(tools) >= maxTools {
			break
		}
	}
	return tools, toolToID
}

// execTool runs one tool call against its MCP and returns a (capped) string
// observation for the model. Errors are returned as "tool error: …" text so the
// model can react rather than the whole run aborting.
func (s *Service) execTool(ctx context.Context, toolToID map[string]string, tc llm.ToolCall) string {
	id, ok := toolToID[tc.Name]
	if !ok {
		return "tool error: unknown tool"
	}
	query := extractQuery(tc.Arguments)
	if query == "" {
		return "tool error: missing query"
	}
	res, err := s.reg.Call(ctx, id, "search", map[string]any{"query": query})
	if err != nil {
		return "tool error: " + err.Error()
	}
	b, _ := json.Marshal(res)
	out := string(b)
	if len(out) > maxObsChars {
		out = out[:maxObsChars] + "…"
	}
	return out
}

func extractQuery(arguments string) string {
	var a struct {
		Query string `json:"query"`
	}
	_ = json.Unmarshal([]byte(arguments), &a)
	return strings.TrimSpace(a.Query)
}

func serverHasSearch(s mcp.Server) bool {
	if len(s.Tools) == 0 {
		return true // unknown tool set — assume the common "search" shape
	}
	for _, t := range s.Tools {
		if t == "search" {
			return true
		}
	}
	return false
}

func validToolName(t string) bool {
	if t == "" || len(t) > 64 {
		return false
	}
	for i := 0; i < len(t); i++ {
		c := t[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '-') {
			return false
		}
	}
	return true
}

func agentSystemPrompt(locale string, nTools int) string {
	b := "You are Pervagans Agent. Complete the user's task by calling the available connector tools to gather real information, then deliver a clear, well-organised final answer. " +
		"Plan briefly, call one or more tools when useful, and once you have enough evidence, stop calling tools and write the final answer. " +
		"Attribute facts to the connectors you used. Never fabricate tool results."
	if nTools == 0 {
		b += " No connectors are available this run, so answer directly from your own knowledge and say which external checks you'd run if connectors were attached."
	}
	if locale == "ar" {
		b += " Respond in Arabic if the user writes in Arabic."
	}
	return b
}

func writeJSONErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

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
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/llm"
	"github.com/pervagans/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
)

const (
	maxIters    = 5    // plan/act rounds before we force a final answer
	maxTools    = 8    // distinct connectors exposed to the model per run
	maxToolDefs = 32   // hard cap on total function tools handed to the model
	maxObsChars = 3000 // cap each tool observation fed back into the context
	agentModel  = "qwen-3.7-max"
)

// CredentialProvider returns a user's stored per-connector upstream credential.
// Implemented by the connectors service; nil-safe (a nil provider means every
// call falls back to the pod's shared environment token).
type CredentialProvider interface {
	Credential(ctx context.Context, userID, mcpID string) (string, bool)
}

// UsageMeter enforces per-plan monthly credit caps. nil-safe + fail-open.
// An agent run is one of the most expensive operations, so it's metered.
type UsageMeter interface {
	Check(ctx context.Context, userID, plan, op string) (bool, int)
	Record(userID, plan, op, model string)
}

type Service struct {
	llm   *llm.Client
	reg   *mcp.Registry
	auth  *auth.Service
	creds CredentialProvider
	meter UsageMeter
}

func New(l *llm.Client, r *mcp.Registry, a *auth.Service, creds CredentialProvider, meter UsageMeter) *Service {
	return &Service{llm: l, reg: r, auth: a, creds: creds, meter: meter}
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

	// Per-plan monthly credit cap (BEFORE SSE headers so an over-budget user
	// gets a normal HTTP 402). Agent runs are expensive; charged on accept.
	if u := auth.FromContext(r.Context()); u != nil && s.meter != nil {
		if ok, _ := s.meter.Check(r.Context(), u.ID, u.Plan, "agent"); !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": "Monthly usage limit reached for your plan — upgrade to continue.",
				"code":  "quota_exceeded",
			})
			return
		}
		s.meter.Record(u.ID, u.Plan, "agent", agentModel)
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

	// Expose the user's connected MCPs (capped) as function tools — every tool
	// each connector declares, with its real input schema, namespaced
	// connector__tool. Discovery hits the live pods, so this needs the ctx.
	tools, refs := s.buildTools(ctx, req.UseMcps)
	send("status", map[string]any{"phase": "planning", "tools": len(tools)})

	messages := []map[string]any{
		{"role": "system", "content": agentSystemPrompt(req.Locale, len(tools))},
		{"role": "user", "content": req.Task},
	}

	// Accumulate the tool results as provenance so the agent answer carries
	// numbered source cards (P3) — agent mode previously emitted ZERO citations.
	// Shape matches the chat path's {source, result} so the frontend renders
	// them with the existing SourceCards (ConnectorIcon by source name).
	sources := []map[string]any{}
	addSource := func(toolName, obs string) {
		if len(sources) >= 16 {
			return
		}
		// Display name = the connector, not the namespaced function. Prefer the
		// resolved connector id; else the namespace before "__".
		name := toolName
		if ref, ok := refs[toolName]; ok && ref.id != "" {
			name = ref.id
		} else if i := strings.Index(toolName, "__"); i > 0 {
			name = toolName[:i]
		}
		res := obs
		if len(res) > 1000 {
			res = res[:1000] + "…"
		}
		sources = append(sources, map[string]any{"source": name, "result": res})
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
			if len(sources) > 0 {
				send("sources", sources)
			}
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
			query := argSummary(tc.Arguments)
			send("step", map[string]any{"phase": "action", "tool": tc.Name, "query": query})
			obs := s.execTool(ctx, refs, tc)
			ok := !strings.HasPrefix(obs, "tool error")
			// P5: stream a short preview of what the tool returned/wrote so the
			// work pane shows real progress (what was fetched), not just a
			// success dot. Full result is in the P3 source card below the answer.
			preview := strings.TrimSpace(obs)
			if len(preview) > 280 {
				preview = preview[:280] + "…"
			}
			send("step", map[string]any{"phase": "observation", "tool": tc.Name, "ok": ok, "preview": preview})
			if ok {
				addSource(tc.Name, obs)
			}
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
		if len(sources) > 0 {
			send("sources", sources)
		}
		send("answer", map[string]any{"content": content})
	}
	send("done", map[string]any{})
}

// toolRef maps a model-facing function name back to the concrete tool to run.
// Either a self-hosted connector (id+tool via the registry) or a remote MCP
// server (remote=connector UUID, tool via the remote JSON-RPC client).
type toolRef struct {
	id     string
	tool   string
	remote string
}

// remoteProvider is the subset of the connectors service the agent uses to
// expose + call the user's connected remote MCP servers. Satisfied by
// *connectors.Service; absent (type-assertion fails) → no remote tools.
type remoteProvider interface {
	RemoteAgentTools(ctx context.Context, userID string) []mcp.RemoteTool
	CallRemoteTool(ctx context.Context, userID, connectorID, tool string, args map[string]any) (any, error)
}

// toolSpec is one tool a connector declares — name + description + the real
// JSON-Schema for its arguments (from the live pod's /tools, or a degraded
// fallback).
type toolSpec struct {
	name        string
	description string
	inputSchema map[string]any
}

// buildTools turns the user's connected MCP ids into function tools. For each
// connector it discovers EVERY tool the pod declares (search, create, page,
// send, …) with that tool's real input schema, and exposes each as a separate
// function named connector__tool so the model can pick the right action with
// the right arguments — not just a single hard-coded {query} search. Returns
// the tool defs plus a map from function name back to (connector, tool).
func (s *Service) buildTools(ctx context.Context, useMcps []string) ([]llm.ToolDef, map[string]toolRef) {
	tools := []llm.ToolDef{}
	refs := map[string]toolRef{}
	seenConn := map[string]bool{}
	nConn := 0
	for _, id := range useMcps {
		id = strings.TrimSpace(id)
		if id == "" || seenConn[id] || !validToolName(id) {
			continue
		}
		srv, ok := s.reg.Get(id)
		if !ok {
			continue
		}
		seenConn[id] = true
		specs := s.discoverTools(ctx, srv)
		if len(specs) == 0 {
			continue
		}
		nConn++
		for _, sp := range specs {
			fnName := toolFnName(id, sp.name)
			if fnName == "" {
				continue
			}
			if _, dup := refs[fnName]; dup {
				continue
			}
			desc := sp.description
			if desc == "" {
				desc = sp.name + " on " + srv.Name
			} else {
				desc = srv.Name + ": " + desc
			}
			params := sp.inputSchema
			if params == nil {
				params = genericQuerySchema()
			}
			tools = append(tools, llm.ToolDef{Name: fnName, Description: desc, Parameters: params})
			refs[fnName] = toolRef{id: id, tool: sp.name}
			if len(tools) >= maxToolDefs {
				return tools, refs
			}
		}
		if nConn >= maxTools {
			break
		}
	}

	// Append the user's connected REMOTE MCP servers' tools (external servers
	// connected via the MCP authorization flow). Auto-included — not gated on
	// req.UseMcps — since the user explicitly connected them. Each is namespaced
	// r<shorthex>__<tool>; the real connector UUID lives in the refs map.
	if rp, ok := s.creds.(remoteProvider); ok && len(tools) < maxToolDefs {
		if u := auth.FromContext(ctx); u != nil {
			for _, rt := range rp.RemoteAgentTools(ctx, u.ID) {
				if len(tools) >= maxToolDefs {
					break
				}
				fnName := toolFnName("r"+shortHex(rt.ConnectorID), rt.Name)
				if fnName == "" {
					continue
				}
				if _, dup := refs[fnName]; dup {
					continue
				}
				desc := rt.Description
				if desc == "" {
					desc = rt.Name
				}
				params := rt.InputSchema
				if params == nil {
					params = genericQuerySchema()
				}
				tools = append(tools, llm.ToolDef{Name: fnName, Description: desc, Parameters: params})
				refs[fnName] = toolRef{remote: rt.ConnectorID, tool: rt.Name}
			}
		}
	}
	return tools, refs
}

// shortHex returns up to the first 8 hex chars of an id (e.g. a UUID), for a
// compact, charset-safe function-name prefix. The full id is kept in refs.
func shortHex(id string) string {
	var b strings.Builder
	for i := 0; i < len(id) && b.Len() < 8; i++ {
		c := id[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
			b.WriteByte(c)
		}
	}
	return b.String()
}

// discoverTools asks the live pod for its tool list + schemas (GET /tools). On
// any failure it degrades to the manifest's declared tool names with a generic
// {query} schema, so the connector still works (the model just doesn't get the
// precise arg shape). Legacy entries that declare no tools fall back to a lone
// "search" tool.
func (s *Service) discoverTools(ctx context.Context, srv mcp.Server) []toolSpec {
	cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if raw, err := s.reg.ListTools(cctx, srv.ID); err == nil {
		if specs := parseToolSpecs(raw); len(specs) > 0 {
			return specs
		}
	}
	out := []toolSpec{}
	for _, name := range srv.Tools {
		if validToolName(name) {
			out = append(out, toolSpec{name: name, inputSchema: genericQuerySchema()})
		}
	}
	if len(out) == 0 {
		out = append(out, toolSpec{name: "search", inputSchema: genericQuerySchema()})
	}
	return out
}

// parseToolSpecs reads the {tools:[{name,description,inputSchema}]} envelope the
// MCP base serves at /tools. The registry hands it back as decoded `any`, so we
// round-trip through JSON into a typed shape.
func parseToolSpecs(raw any) []toolSpec {
	b, err := json.Marshal(raw)
	if err != nil {
		return nil
	}
	var env struct {
		Tools []struct {
			Name        string         `json:"name"`
			Description string         `json:"description"`
			InputSchema map[string]any `json:"inputSchema"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(b, &env); err != nil {
		return nil
	}
	out := []toolSpec{}
	for _, t := range env.Tools {
		if t.Name == "" || !validToolName(t.Name) {
			continue
		}
		out = append(out, toolSpec{name: t.Name, description: t.Description, inputSchema: t.InputSchema})
	}
	return out
}

// toolFnName builds the model-facing function name connector__tool. The tool
// part is sanitised to the OpenAI function-name charset ([a-zA-Z0-9_-]); the
// real tool name is preserved in the refs map, so a '.'→'_' rewrite here never
// affects what the registry actually calls. Returns "" if the result would
// exceed the 64-char function-name limit.
func toolFnName(id, tool string) string {
	name := id + "__" + sanitizeFn(tool)
	if len(name) == 0 || len(name) > 64 {
		return ""
	}
	return name
}

func sanitizeFn(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '-' {
			b.WriteByte(c)
		} else {
			b.WriteByte('_')
		}
	}
	return b.String()
}

func genericQuerySchema() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{"query": map[string]any{"type": "string", "description": "search query or input"}},
		"required":   []string{"query"},
	}
}

// execTool runs one tool call against its MCP and returns a (capped) string
// observation for the model. The model-chosen function name is mapped back to
// the concrete (connector, tool), and the FULL argument object is forwarded —
// not just a query string — so create/update/send tools receive their real
// parameters. Errors are returned as "tool error: …" text so the model can
// react rather than the whole run aborting.
func (s *Service) execTool(ctx context.Context, refs map[string]toolRef, tc llm.ToolCall) string {
	ref, ok := refs[tc.Name]
	if !ok {
		return "tool error: unknown tool"
	}
	var args map[string]any
	if strings.TrimSpace(tc.Arguments) != "" {
		if err := json.Unmarshal([]byte(tc.Arguments), &args); err != nil {
			return "tool error: invalid arguments json"
		}
	}
	if args == nil {
		args = map[string]any{}
	}
	// Remote MCP server → JSON-RPC tools/call with the user's bearer.
	if ref.remote != "" {
		rp, ok := s.creds.(remoteProvider)
		if !ok {
			return "tool error: remote connectors unavailable"
		}
		u := auth.FromContext(ctx)
		if u == nil {
			return "tool error: unauthorized"
		}
		res, err := rp.CallRemoteTool(ctx, u.ID, ref.remote, ref.tool, args)
		if err != nil {
			return "tool error: " + err.Error()
		}
		return capObs(res)
	}
	// Self-hosted connector → forward the user's own credential (if stored) so
	// the pod authenticates as them instead of using the shared env token.
	if s.creds != nil {
		if u := auth.FromContext(ctx); u != nil {
			if cred, ok := s.creds.Credential(ctx, u.ID, ref.id); ok {
				ctx = mcp.WithCredential(ctx, cred)
			}
		}
	}
	res, err := s.reg.Call(ctx, ref.id, ref.tool, args)
	if err != nil {
		return "tool error: " + err.Error()
	}
	return capObs(res)
}

// capObs marshals a tool result and caps it to maxObsChars for the model.
func capObs(res any) string {
	b, _ := json.Marshal(res)
	out := string(b)
	if len(out) > maxObsChars {
		out = out[:maxObsChars] + "…"
	}
	return out
}

// argSummary produces a short human-readable preview of a tool call's arguments
// for the SSE "action" step (the query field if present, else a truncated dump).
func argSummary(arguments string) string {
	var a map[string]any
	if json.Unmarshal([]byte(arguments), &a) == nil {
		if q, ok := a["query"].(string); ok && strings.TrimSpace(q) != "" {
			return q
		}
	}
	t := strings.TrimSpace(arguments)
	if len(t) > 160 {
		t = t[:160] + "…"
	}
	return t
}

func validToolName(t string) bool {
	if t == "" || len(t) > 64 {
		return false
	}
	for i := 0; i < len(t); i++ {
		c := t[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '-' || c == '.') {
			return false
		}
	}
	return true
}

func agentSystemPrompt(locale string, nTools int) string {
	b := "You are Pervagans Agent. Complete the user's task by calling the available connector tools to gather real information or take actions, then deliver a clear, well-organised final answer. " +
		"Each tool is named connector__action (e.g. notion__search, notion__create, gmail__send); choose the specific action that fits the step and pass its arguments per the tool's schema. " +
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

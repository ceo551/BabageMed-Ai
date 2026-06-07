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
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/db"
	"github.com/pervagans/backend/internal/llm"
	"github.com/pervagans/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
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

// Notifier sends a Web Push when an async run finishes (P6.5). nil → no push
// (the /tasks page still polls), so it's optional + nil-safe.
type Notifier interface {
	Send(userID, title, body, url string)
}

type Service struct {
	llm   *llm.Client
	auth  *auth.Service
	creds CredentialProvider
	meter UsageMeter
	db    *db.DB    // P6: persist async runs; nil → background runs disabled
	push  Notifier  // P6.5: notify on completion; nil → polling only
}

func New(l *llm.Client, a *auth.Service, creds CredentialProvider, meter UsageMeter, d *db.DB, push Notifier) *Service {
	return &Service{llm: l, auth: a, creds: creds, meter: meter, db: d, push: push}
}

func (s *Service) Register(r chi.Router, limiter func(http.Handler) http.Handler) {
	r.Group(func(gr chi.Router) {
		gr.Use(s.auth.Required)
		gr.Use(limiter)
		gr.Post("/api/agent/stream", s.handleStream)
		// P6: async "delegate" runs — assign, close the tab, poll for the result.
		gr.Post("/api/agent/runs", s.handleCreateRun)
		gr.Get("/api/agent/runs", s.handleListRuns)
		gr.Get("/api/agent/runs/{id}", s.handleGetRun)
	})
}

type agentReq struct {
	Task    string   `json:"task"`
	UseMcps []string `json:"useMcps"`
	Locale  string   `json:"locale"`
	// Prior conversation turns (user/assistant) so a follow-up agent task has
	// context instead of starting cold. The current task is sent separately in
	// Task and appended after this history.
	Messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
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
	var writeMu sync.Mutex
	send := func(event string, data any) bool {
		if ctx.Err() != nil {
			return false
		}
		b, _ := json.Marshal(data)
		writeMu.Lock()
		defer writeMu.Unlock()
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(b)); err != nil {
			return false
		}
		if flush != nil {
			flush.Flush()
		}
		return true
	}

	// Heartbeat: a comment frame every 15s so the connection doesn't idle-timeout
	// during the agent's long silent windows (tool discovery, blocking LLM
	// rounds). The WaitGroup guarantees the goroutine stops before this handler
	// returns, so it never writes to a finalized ResponseWriter.
	hbStop := make(chan struct{})
	var hbWG sync.WaitGroup
	hbWG.Add(1)
	go func() {
		defer hbWG.Done()
		t := time.NewTicker(15 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-hbStop:
				return
			case <-t.C:
				writeMu.Lock()
				live := ctx.Err() == nil
				if live {
					_, _ = fmt.Fprint(w, ": ping\n\n")
					if flush != nil {
						flush.Flush()
					}
				}
				writeMu.Unlock()
				if !live {
					return
				}
			}
		}
	}()
	defer func() {
		close(hbStop)
		hbWG.Wait()
	}()

	// Expose the user's connected MCPs (capped) as function tools — every tool
	// each connector declares, with its real input schema, namespaced
	// connector__tool. Discovery hits the live pods, so this needs the ctx.
	tools, refs := s.buildTools(ctx, req.UseMcps)
	send("status", map[string]any{"phase": "planning", "tools": len(tools)})

	messages := []map[string]any{
		{"role": "system", "content": agentSystemPrompt(req.Locale, len(tools))},
	}
	// Seed prior conversation turns (most recent window) so a follow-up agent
	// task resolves "do that again" / pronouns against real context instead of
	// starting cold.
	{
		const maxAgentHistory = 12
		hist := req.Messages
		if len(hist) > maxAgentHistory {
			hist = hist[len(hist)-maxAgentHistory:]
		}
		for _, m := range hist {
			if m.Role != "user" && m.Role != "assistant" {
				continue
			}
			c := strings.TrimSpace(m.Content)
			if c == "" {
				continue
			}
			if len(c) > 12000 {
				c = c[:12000]
			}
			messages = append(messages, map[string]any{"role": m.Role, "content": c})
		}
		// The seeded window must start on a user turn (provider 400 otherwise).
		for len(messages) > 1 && messages[1]["role"] != "user" {
			messages = append(messages[:1], messages[2:]...)
		}
	}
	messages = append(messages, map[string]any{"role": "user", "content": req.Task})

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

// ─── Async "delegate" runs (P6) ──────────────────────────────────────────────

const (
	maxAsyncRuns    = 50              // recent runs returned by the list endpoint
	asyncRunTimeout = 6 * time.Minute // hard cap on a detached run
)

type runRow struct {
	ID         string          `json:"id"`
	Task       string          `json:"task"`
	Status     string          `json:"status"`
	Steps      json.RawMessage `json:"steps"`
	Result     string          `json:"result"`
	Error      string          `json:"error"`
	CreatedAt  time.Time       `json:"createdAt"`
	FinishedAt *time.Time      `json:"finishedAt"`
}

// isUUIDish guards the {id} path param so a malformed id returns 404 instead of
// a Postgres "invalid input syntax for type uuid" 500 (no regexp import).
func isUUIDish(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
		} else if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func (s *Service) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONErr(w, 503, "runs unavailable")
		return
	}
	u := auth.FromContext(r.Context())
	if u == nil {
		writeJSONErr(w, 401, "unauthorized")
		return
	}
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
	// Per-plan credit cap (an async run costs the same as a live one).
	if s.meter != nil {
		if ok, _ := s.meter.Check(r.Context(), u.ID, u.Plan, "agent"); !ok {
			writeJSONErr(w, 402, "Monthly usage limit reached for your plan — upgrade to continue.")
			return
		}
		s.meter.Record(u.ID, u.Plan, "agent", agentModel)
	}
	var id string
	if err := s.db.Pool.QueryRow(r.Context(), `
        INSERT INTO agent_runs (user_id, task, status) VALUES ($1, $2, 'running') RETURNING id::text
    `, u.ID, req.Task).Scan(&id); err != nil {
		log.Printf("agent: create run %v", err)
		writeJSONErr(w, 500, "could not start run")
		return
	}
	// Detach: the run survives this request. Carry the user so execTool can
	// resolve their per-connector credentials; cap the lifetime hard. The
	// agentLimiter (2/min) + timeout bound concurrency without a worker pool.
	go s.executeRun(id, u, req)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"id": id, "status": "running"})
}

// executeRun runs the plan→act loop on a DETACHED context and records the
// outcome to agent_runs. Mirrors handleStream's loop but writes to the DB
// instead of streaming — the live SSE path is intentionally left untouched.
func (s *Service) executeRun(runID string, u *auth.User, req agentReq) {
	ctx, cancel := context.WithTimeout(auth.WithUser(context.Background(), u), asyncRunTimeout)
	defer cancel()

	steps := []map[string]any{}
	// finish writes the terminal state AND fires the completion push (P6.5).
	// Defined before the panic-recovery defer so that path can notify too.
	finish := func(status, result, errMsg string) {
		s.finishRun(runID, status, steps, result, errMsg)
		if s.push != nil {
			mark := "✓ "
			if status == "failed" {
				mark = "⚠ "
			}
			body := strings.TrimSpace(req.Task)
			if len(body) > 90 {
				body = body[:90] + "…"
			}
			s.push.Send(u.ID, mark+notifyTitle(req.Locale, status), body, "/tasks")
		}
	}
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("agent: run %s panic: %v", runID, rec)
			finish("failed", "", "internal error")
		}
	}()

	tools, refs := s.buildTools(ctx, req.UseMcps)
	messages := []map[string]any{
		{"role": "system", "content": agentSystemPrompt(req.Locale, len(tools))},
		{"role": "user", "content": req.Task},
	}
	for iter := 0; iter < maxIters; iter++ {
		content, calls, err := s.llm.ChatWithTools(ctx, agentModel, messages, tools)
		if err != nil {
			finish("failed", "", "agent step failed")
			return
		}
		if len(calls) == 0 {
			finish("done", content, "")
			return
		}
		tcArr := make([]map[string]any, 0, len(calls))
		for _, tc := range calls {
			tcArr = append(tcArr, map[string]any{"id": tc.ID, "type": "function", "function": map[string]any{"name": tc.Name, "arguments": tc.Arguments}})
		}
		messages = append(messages, map[string]any{"role": "assistant", "content": content, "tool_calls": tcArr})
		for _, tc := range calls {
			obs := s.execTool(ctx, refs, tc)
			ok := !strings.HasPrefix(obs, "tool error")
			preview := strings.TrimSpace(obs)
			if len(preview) > 280 {
				preview = preview[:280] + "…"
			}
			steps = append(steps, map[string]any{"tool": tc.Name, "query": argSummary(tc.Arguments), "ok": ok, "preview": preview})
			messages = append(messages, map[string]any{"role": "tool", "tool_call_id": tc.ID, "content": obs})
		}
		s.persistSteps(runID, steps) // incremental progress for the poller
	}
	// Iteration cap — one more pass for a final synthesis with no tools.
	messages = append(messages, map[string]any{"role": "user", "content": "Stop calling tools now and write your best final answer from what you've gathered, citing connectors by name."})
	content, _, err := s.llm.ChatWithTools(ctx, agentModel, messages, nil)
	if err != nil {
		finish("failed", "", "agent synthesis failed")
		return
	}
	finish("done", content, "")
}

// notifyTitle is the Web Push title for a finished async run.
func notifyTitle(locale, status string) string {
	ar := locale == "ar"
	if status == "failed" {
		if ar {
			return "فشلت المهمة"
		}
		return "Task failed"
	}
	if ar {
		return "خلصت المهمة"
	}
	return "Task finished"
}

func (s *Service) persistSteps(runID string, steps []map[string]any) {
	b, _ := json.Marshal(steps)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = s.db.Pool.Exec(ctx, `UPDATE agent_runs SET steps = $2::jsonb WHERE id = $1`, runID, string(b))
}

func (s *Service) finishRun(runID, status string, steps []map[string]any, result, errMsg string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var stepsJSON any
	if steps != nil {
		b, _ := json.Marshal(steps)
		stepsJSON = string(b)
	}
	if _, err := s.db.Pool.Exec(ctx, `
        UPDATE agent_runs
        SET status = $2, result = NULLIF($3, ''), error = NULLIF($4, ''),
            steps = COALESCE($5::jsonb, steps), finished_at = now()
        WHERE id = $1
    `, runID, status, result, errMsg, stepsJSON); err != nil {
		log.Printf("agent: finish run %s: %v", runID, err)
	}
}

func (s *Service) handleListRuns(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONErr(w, 503, "runs unavailable")
		return
	}
	u := auth.FromContext(r.Context())
	rows, err := s.db.Pool.Query(r.Context(), `
        SELECT id::text, task, status, steps, COALESCE(result, ''), COALESCE(error, ''), created_at, finished_at
        FROM agent_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
    `, u.ID, maxAsyncRuns)
	if err != nil {
		writeJSONErr(w, 500, "internal error")
		return
	}
	defer rows.Close()
	out := []runRow{}
	for rows.Next() {
		var rr runRow
		var stepsRaw []byte // scan JSONB via []byte (proven path), then wrap
		if err := rows.Scan(&rr.ID, &rr.Task, &rr.Status, &stepsRaw, &rr.Result, &rr.Error, &rr.CreatedAt, &rr.FinishedAt); err != nil {
			writeJSONErr(w, 500, "internal error")
			return
		}
		rr.Steps = json.RawMessage(stepsRaw)
		out = append(out, rr)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (s *Service) handleGetRun(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSONErr(w, 503, "runs unavailable")
		return
	}
	u := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	if !isUUIDish(id) {
		writeJSONErr(w, 404, "not found")
		return
	}
	var rr runRow
	var stepsRaw []byte
	err := s.db.Pool.QueryRow(r.Context(), `
        SELECT id::text, task, status, steps, COALESCE(result, ''), COALESCE(error, ''), created_at, finished_at
        FROM agent_runs WHERE id = $1 AND user_id = $2
    `, id, u.ID).Scan(&rr.ID, &rr.Task, &rr.Status, &stepsRaw, &rr.Result, &rr.Error, &rr.CreatedAt, &rr.FinishedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONErr(w, 404, "not found")
		return
	}
	if err != nil {
		writeJSONErr(w, 500, "internal error")
		return
	}
	rr.Steps = json.RawMessage(stepsRaw)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rr)
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

// buildTools exposes the user's connected REMOTE MCP servers' tools as model
// functions (namespaced r<shorthex>__<tool>), returning the tool defs + a map
// from function name back to the connector. Self-hosted MCPs were removed.
func (s *Service) buildTools(ctx context.Context, _ []string) ([]llm.ToolDef, map[string]toolRef) {
	// Self-hosted MCP connectors were removed; the agent now exposes ONLY the
	// user's connected REMOTE MCP servers (the useMcps arg is ignored).
	tools := []llm.ToolDef{}
	refs := map[string]toolRef{}

	// The user's connected REMOTE MCP servers' tools (external servers
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
	// Self-hosted MCP connectors were removed — every tool is now a remote one,
	// so a ref without a remote id shouldn't occur.
	return "tool error: unknown tool"
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

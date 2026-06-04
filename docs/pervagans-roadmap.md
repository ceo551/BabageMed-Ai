# Pervagans Technical Roadmap

_Derived from the 25-agent competitor teardown ([ai-winners-teardown.md](./ai-winners-teardown.md)) + a 5-agent codebase audit of the actual current state. Every task below is grounded in real files/lines, not assumptions._

---

## Reality check — what the codebase audit corrected vs the strategy doc

| Strategy-doc assumption | Verified reality |
|---|---|
| "Open an anonymous trial surface" | **Anonymous chat already works.** `/api/chat` + `/api/chat/stream` run under `auth.Optional` and are auto-clamped by `clampForAnon()` (handler.go:596) → model forced to `glm-5.1`, web/MCP/deep-research disabled, IP-rate-limited 10/min. **But** agent, image, video, and MCP-call endpoints are hard `auth.Required`. So the trial is _partly built_; widening it is the work. |
| "PushNotification is wired" | **False — confirmed.** `public/sw.js` has NO `push` listener, no VAPID, no backend web-push. Service worker only caches assets. Push is 100% net-new. |
| "Async agent — close the tab, get notified" | **Nothing exists.** Agent loop is synchronous SSE bound to the HTTP request; client disconnect kills the run. No queue, no `agent_runs` table, no worker. (Only `media_assets` has an async task_id pattern, for video.) |
| "Make citations the default everywhere" | Web-search (Brave) + MCP `search`-tool citations already render as numbered cards. **But** agent-mode produces zero citations, non-`search` MCP tools produce zero citations, and space/file retrieval has no numbered citations. `chat_messages.citations JSONB` column already exists. |
| "Price by task complexity / cap free usage" | **No metering exists at all.** No usage ledger, no cost table, no per-user/per-plan quota — only IP rate-limits + the anon clamp. This is the critic's #1 economic risk and the true prerequisite for widening the funnel. |
| Per-Space memory | Spaces already store `instructions`, `skills` (labels), `default_model`, files+FTS chunks. Injection point exists (`buildSystem()` handler.go:752). Missing: a saved-facts/preferences store. Next migration = **020**. |

**Two hard constraints to design around (from the critic):**
1. **Inverted unit economics** — Pervagans pays upstream (Anthropic/OpenAI/DashScope) per token. Free/anonymous expansion is dangerous *until metering + caps exist*. → Metering is a **prerequisite**, not a phase-8 afterthought.
2. **"Arabic = empty field" is a hypothesis, not a fact** (Meta AI on WhatsApp, Falcon/Jais/ALLaM, Gemini all serve Arabic). → Treat the Arabic wedge as something to *validate with an eval set*, not assume.

---

## Sequencing logic

Ordered by **(moat value × infra-readiness) ÷ (risk × effort)**, respecting dependencies and the economic constraint:

```
P1 Per-Space Memory ────────────────┐ (independent, highest moat, additive)
P2 Usage Metering + Caps ────────────┤ (economic prerequisite for P4)
P3 Citations Everywhere ─────────────┤ (extends existing infra)
                                     │
P4 Anonymous Trial + Share/Remix ◄───┘ (REQUIRES P2 caps)
P5 Visible Agent Work Pane ──────────  (extends agent SSE)
P6 Async Delegate + Push ────────────  (REQUIRES P5; biggest net-new build)

Parallel track: Arabic Eval Harness (validation, ongoing)
GTM (not eng): Demo video, WhatsApp/Telegram bot — after P5/P6
```

Effort key: **S** ≈ 1–2 days · **M** ≈ 3–5 days · **L** ≈ 1–2 weeks · **XL** ≈ 3+ weeks (single dev).

---

## P1 — Per-Space Persistent Memory  ·  Effort: **M**  ·  Moat: ★★★★★
> _From: ChatGPT (memory = the switching cost) + Manus (reusable Skills) + Claude (Projects). The teardown's single most-named missing lever: "Spaces without accumulating memory are folders, not moats."_

**Current state:** `spaces` table has `instructions`/`skills`/`default_model`; `buildSystem()` (handler.go:752–928) already injects space instructions + file chunks into the system prompt. No structured memory store.

**Tasks (ordered):**
1. **Migration `020_space_memory.up.sql`** — new table:
   ```sql
   space_memory (
     id UUID PK, space_id UUID FK→spaces ON DELETE CASCADE, user_id UUID FK,
     kind TEXT CHECK (kind IN ('fact','preference','connector_state')),
     content TEXT NOT NULL,           -- the remembered statement
     source TEXT,                     -- 'user' | 'inferred' | 'connector:<id>'
     weight REAL DEFAULT 1.0,         -- for future ranking/decay
     created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
   );  -- index (space_id, kind)
   ```
2. **Backend `spaces.go`** — add `Memory` CRUD methods + routes mirroring the existing file routes:
   `GET/POST /api/spaces/{id}/memory`, `DELETE /api/spaces/{id}/memory/{memId}` (all `auth.Required`).
3. **Inject memory into the prompt** — in `buildSystem()` (handler.go), add a `space_memory` block right after the space-instructions block (~line 806), fenced + sanitized like the existing untrusted blocks. Frontend sends `spaceMemory` in the chat request (or backend loads it server-side by `space_id` — **prefer server-side load** so it can't be spoofed by the client).
4. **Auto-inference (phase 2 of P1)** — after an assistant turn in a space, fire a cheap async `glm-5.1` call: _"Extract any durable user preferences/facts worth remembering from this exchange; return JSON or empty."_ Insert as `kind='preference', source='inferred'`. Gate behind a per-space toggle + show inferred items as **user-editable/deletable** (trust).
5. **Promote Skills from labels → re-invokable** — `skills JSONB` is currently plain text labels. Add an optional `body` per skill (a saved instruction/workflow, Manus "SKILL.md" style) the user can re-invoke. (Can defer to P1.5.)
6. **Frontend** — a "Memory" card in `apps/web/app/spaces/[id]/page.tsx` (mirror `InstructionsCard`/`SkillsCard` at lines 307–545): list saved facts, add/delete, toggle auto-inference.

**Acceptance:** After saving facts in a Space, a new chat in that Space reflects them with no re-explanation; inferred items are visible and deletable; leaving the Space = losing a configured workspace, not just logs.

---

## P2 — Usage Metering + Caps (economic foundation)  ·  Effort: **M–L**  ·  Moat: ★★★ (survival)
> _From: Manus (price ∝ task cost) + ChatGPT (free tier as data engine). **Critic's #1 priority** — the prerequisite that makes P4 safe given wrapper economics._

**Current state:** zero usage tracking. Plans (GO/Plus/Pro/Max) + Paddle exist (`payments/plans.go:20`). Only IP rate-limits + `clampForAnon`.

**Tasks (ordered):**
1. **Cost table (code-level)** — `backend/internal/billing/costs.go`: a map of `operation → credit cost` (chat-by-model, agent-run, image, video, deep-research). Start with rough relative credits; refine later. This is the missing "model cost awareness."
2. **Migration `021_usage.up.sql`**:
   ```sql
   usage_ledger (id, user_id NULLABLE, anon_id TEXT NULLABLE, operation TEXT,
                 credits INT, model TEXT, created_at TIMESTAMPTZ);  -- index (user_id, created_at), (anon_id, created_at)
   ```
   (Per-user *and* per-anonymous-session, keyed by a signed `anon_id` cookie for the trial.)
3. **Pre-flight check middleware** — a helper `billing.Check(ctx, op, model) → (allowed, costPreview, remaining)` called at the head of each expensive handler:
   - Chat/stream (handler.go:169/192), Agent (agent.go:64), Image (media.go:142), Video (media.go:199), Deep-research (inside `gather()`).
   - Returns `402`/`429` with a structured `{needed, remaining, plan}` body when over cap.
4. **Per-plan quotas** — config map: free/anon = tiny; GO/Plus/Pro/Max = increasing monthly credit grants + per-op caps on the expensive ones (agent/video). Read `users.plan`.
5. **Record-after** — log actual consumption to `usage_ledger` post-operation (even if upstream token counts are estimated at first).
6. **Frontend cost preview** — before running agent / video / deep-research, show "_this will use ~N credits_" (read from a `GET /api/usage/preview?op=` endpoint). Transparent, unlike Manus's opaque credits (the teardown flags opacity as a trust-killer).
7. **Per-user rate limiting** — today rate-limits are IP-only (authenticated users share buckets with strangers). Add a user-keyed limiter layer for logged-in users.

**Acceptance:** An anonymous session and a free user both hit a hard, visible cap on expensive ops; cost preview shows before heavy tasks; a runaway loop can't silently burn upstream spend.

---

## P3 — Citations Everywhere (trust primitive)  ·  Effort: **M**  ·  Moat: ★★★★
> _From: Perplexity (citations as THE trust primitive). Widens the existing mechanism from web-search-only to every grounded source._

**Current state:** `{source, result}` citation objects render as numbered cards (`AssistantMessage.tsx:14–182`, `dashboard.css:779–832`). Only web-search + MCP `search` populate them. Agent mode, non-`search` MCP tools, and file/space retrieval produce none. `chat_messages.citations JSONB` column already exists.

**Tasks (ordered):**
1. **Normalize a provenance shape** — extend the citation object to `{source, kind: 'web'|'mcp'|'file'|'tool', title?, url?, ref?, result}`. Backward-compatible with the current `{source, result}`.
2. **Agent-mode citations** — in `agent.go` `execTool()` (line 381), capture each tool observation as a structured source (connector id + tool + a short ref), accumulate them, and emit a final `sources` SSE event + persist to `chat_messages.citations`. Currently the observation is only fed to the model (line 141) and the answer is plain text.
3. **Space/file citations** — when `spaceContext` chunks are used (handler.go:884), emit each used chunk as a `kind:'file'` citation (filename + chunk idx) instead of just instructing the model to cite by filename.
4. **Non-`search` connector results in chat** — when a connector tool other than `search` contributes, attach it as a `kind:'mcp'` citation.
5. **Frontend** — extend `normaliseCitations()` (AssistantMessage.tsx:92) to render the new kinds (file → doc icon + filename#chunk; tool → connector icon + "via Notion"). Make the provenance trail ("why I said this") clickable.
6. **Make it the default** — a per-answer "grounded" indicator; when an answer used any source, citations always show (no toggle to hide).

**Acceptance:** Every factual answer that used web/MCP/file/agent-tool data shows clickable numbered sources — including "this came from *this* Notion block" — not just web search.

---

## P4 — Anonymous Trial + Share/Remix  ·  Effort: **M–L**  ·  Moat: ★★★★  ·  **Requires P2**
> _From: ChatGPT (zero-friction entry) + Claude (publish-to-URL + remix) + Perplexity (citations on first answer). Reverses the v79 login-wall deviation — for the trial surface only._

**Current state:** `middleware.ts` (line 5) gates everything except `/login|/signup|/forgot-password|/reset-password|/verify-email`. Anonymous chat infra exists but agent/image/MCP are walled. No share-URL, no remix, no Turnstile.

**Tasks (ordered):**
1. **⚠️ Gate on P2 first.** Do not widen anonymous access to any expensive op until metering + hard caps are live.
2. **Trial route** — add a `/try` (and `/s/[shareId]` for shared outputs) allowlist to `middleware.ts` and `AppShell.tsx` AUTH_ROUTE so they render without forcing login. Keep the workspace gated.
3. **Signed `anon_id` cookie** — issue a short-lived signed cookie on first `/try` hit; the metering ledger keys anonymous usage to it. Caps: e.g. ~3 messages / 1 image / 1 agent run (tune to upstream cost).
4. **Turnstile** — add Cloudflare Turnstile on `/try` before the first expensive call (no infra exists today). Cheap abuse defense that isn't a login wall.
5. **Selectively unwall for the trial** — allow a *capped, metered* path to one agent run + one image for `/try` (new dedicated endpoints or an `auth.Optional` + cap check on the existing ones). Keep full agent/image `auth.Required` outside the trial.
6. **Share-URL** — `POST /api/share` → stores a public, read-only snapshot of a chat/answer (with its citations); `/s/[shareId]` renders chrome-free, no login to view. Migration `022_shares`.
7. **One-click Remix** — "Remix in Pervagans" on a shared page → routes to `/try` (or signup) pre-loaded with the prompt. The viral loop.
8. **Arabic-first framing** on `/try` — the differentiated thing worth sharing.

**Acceptance:** A new visitor gets an Arabic, citation-grounded "wow" with no login, can share a public URL that needs no account to view, and one-click-remix it — all within hard, metered caps that protect upstream spend.

---

## P5 — Visible Agent Work Pane  ·  Effort: **M**  ·  Moat: ★★★★
> _From: Manus ("Manus's Computer" live pane — the trust + virality half of its biggest lever)._

**Current state:** Agent SSE emits `step` events with `{phase:'action', tool, query}` and `{phase:'observation', tool, ok}` — but **the observation content is NOT sent** (only an `ok` bool; agent.go:140). Frontend renders a bullet list of tool calls (page.tsx:719). No result preview, no file tracker.

**Tasks (ordered):**
1. **Stream observation summaries** — in `agent.go` `handleStream()`, include a capped, sanitized preview of *what the tool returned/wrote* in the observation event (e.g. first N chars, row count, file name) — not just `ok`. Mind the 3000-char cap (`capObs`).
2. **Distinguish writes** — for connector tools that mutate (create page, send draft), emit a `{phase:'effect', tool, summary}` so the pane can show "✏️ created Notion page X".
3. **Frontend work pane** — replace the flat bullet list (page.tsx:694–728) with a structured live pane: each step as a row (tool icon, action, live result preview, success/error). A collapsible "Agent is working" panel.
4. **Error detail** — surface the actual tool error (today only `ok:false`), so a failed step is legible.

**Acceptance:** While the agent runs, the user watches *what each MCP tool fetched/wrote* in real time — the black-box-trust problem solved, and an intrinsically shareable spectacle.

---

## P6 — Async "Delegate" + Push Notifications  ·  Effort: **XL**  ·  Moat: ★★★★★  ·  **Requires P5**
> _From: Manus (async "assign → close tab → done" — the mental-model-shift half). The single most defensible differentiated bet — and the biggest net-new build._

**Current state:** **Nothing.** Synchronous agent, no queue, no persistence, no push (all confirmed net-new).

**Tasks (ordered):**
1. **Migration `023_agent_runs`** — `agent_runs (id, user_id, space_id?, task TEXT, status 'queued'|'running'|'done'|'failed', steps JSONB, result TEXT, error TEXT, created_at, finished_at)`.
2. **Decouple the loop from HTTP** — refactor `handleStream()` so the agent loop runs in a worker goroutine writing steps/result to `agent_runs`, while the SSE handler becomes a *subscriber* to that run (so live view still works, but the run survives disconnect). Reuse the existing media async pattern (`media.go` task_id polling) as the model.
3. **Worker pool** — a bounded goroutine pool draining queued runs (start in-process; no Redis needed, mirroring the existing in-process rate-limiter philosophy). Enforce P2 caps per run.
4. **Run endpoints** — `POST /api/agent/runs` (enqueue, returns run id), `GET /api/agent/runs/{id}` (status + steps + result), `GET /api/agent/runs` (list). Live view = SSE subscribe to a running id; reload-safe.
5. **Web Push (net-new, full stack):**
   - Generate VAPID keys; store public key in config.
   - Backend web-push sender (`backend/internal/push`), `push_subscriptions` table (migration `024`), `POST /api/push/subscribe`.
   - `public/sw.js`: add `push` + `notificationclick` listeners (currently absent).
   - Frontend: permission prompt + `pushManager.subscribe()` in `ServiceWorker.tsx` (currently caches only).
   - On run completion, send a push: "_مهمتك خلصت — التقرير جاهز_" deep-linking to the run.
6. **Frontend** — "Run in background" toggle on agent mode; a "Tasks" list showing queued/running/done; click → the P5 work pane replayed from persisted steps.

**Acceptance:** Assign a multi-step bilingual task (research → Arabic report in Canvas → save to Notion → draft Gmail), close the tab, receive a push on completion, reopen to the finished deliverable + full replay. Tool → employee.

---

## Parallel track — Arabic Eval Harness  ·  Effort: **M** (then ongoing)  ·  Moat: ★★★★
> _From: Claude (go deep on one measurable bottleneck) + the critic ("validate 'Arabic = empty field', don't assume")._

**Tasks:** Build an internal eval set — Arabic Q&A accuracy, RTL document extraction (contracts), Arabic agent-task completion. Wire per-task model routing (already model-agnostic) to pick the strongest model *per Arabic task* and measure it. Use the results to (a) pick defaults, (b) prove/disprove the Arabic wedge before betting GTM on it, (c) build a defensible data moat (the eval set itself).

**Acceptance:** A repeatable scorecard that says, with numbers, where Pervagans' Arabic agentic quality beats the Western incumbents — and where it doesn't.

---

## GTM (not engineering) — after P5/P6 exist
- **Demo video (Action 6):** one choreographed 60–90s Arabic async-agent run showing a *finished deliverable* (3-supplier research → Arabic comparison in Canvas → Notion → draft email). Invite-gated waitlist on X + LinkedIn. _Only once P5/P6 survive scrutiny._
- **WhatsApp/Telegram bot (Action 7):** a thin bot front-end onto the existing agent/MCP API — meet MENA users in the pipe they already live in. Telecom bundle = opportunistic stretch (rented distribution; never mistake for a moat).
- **Data-residency wedge (critic's gap):** investigate GCC data-residency (Saudi PDPL, UAE) as a structural moat Western incumbents are slow to match — and a constraint on model-routing/WhatsApp.

---

## Recommended first sprint (be honest about capacity)
The critic warned this reads like a 50-person roadmap. For a small team, **do not start all of it.** Highest leverage, lowest risk, shippable first:

1. **P1 Per-Space Memory** — biggest moat, additive, no economic risk. _The single best first move._
2. **P2 Usage Metering + Caps** — the foundation that makes everything else (especially any free/trial expansion) safe. Build the ledger + cost table + pre-flight check.
3. **P3 Citations Everywhere** — extends infra you already have; compounds the trust positioning immediately.

P4 (trial) only after P2 is solid. P5→P6 (visible + async agent) is the differentiated bet, but it's the heaviest — schedule it as a dedicated project, not a side-quest. Validate the Arabic wedge (eval harness) *before* pouring GTM into it.

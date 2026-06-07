# Pervagans Chat — Deep Audit (30 agents)
_26 dimensions, 139 findings (critical: 0, high: 39, medium: 49, low: 51). 2026-06-07._

## High-severity findings (quick index)

1. **[high]** Smooth scroll on every streamed token causes stacked, laggy auto-scroll animations
   - Chat auto-scroll while streaming (stick-to-bottom, suppression, jank) — `apps/web/app/page.tsx:193-196; apps/web/app/features/[slug]/FeatureChat.tsx:193-196; apps/web/app/spaces/[id]/SpaceChat.tsx:143-146`
   - fix: Use `behavior:"auto"` (instant) for the per-token follow scroll. If a polished feel is wanted, keep `smooth` only for the one-time scroll when a brand-new user/loading row is appended (detect via a ref tracking last message id/count) and use `auto` for content-growth deltas. Simplest robust fix: change all three `scrollIntoView({ behavior: "smooth", block: "end" })` calls to `behavior:"auto"`.

2. **[high]** Loader is dropped at response-headers time, leaving an empty/invisible bubble until the first token arrives
   - Loading state before first token — `apps/web/app/page.tsx:566-573 (also FeatureChat.tsx:339-342, SpaceChat.tsx:252-255)`
   - fix: Keep the loading row mounted until the FIRST `delta`/`content` event actually arrives, then swap. Concretely: don't filter out `loadingId` at line 569; instead, on the first delta (when `finalContent === ""` transitions), filter the loader and insert/replace the assistant row in the same setMessages. Alternatively, render a blinking caret/min-height affordance on an empty `.msg-assistant.streaming` bubble so the gap is never blank. Apply the same change in FeatureChat.tsx:339-342 and SpaceChat.tsx:252-255.

3. **[high]** Inline [n] citation markers are inert plain text — no click-through, hover, or scroll-to-source
   - Citations UI — `apps/web/app/components/AssistantMessage.tsx:45-69 (ReactMarkdown render) and :82-124 (normaliseCitations); backend prompt at backend/internal/api/handler.go:872-880`
   - fix: Add a ReactMarkdown text/`p` post-processor (or a rehype plugin) that scans rendered text for /\[(\d+)\]/ and replaces each with an anchor/button. Map the captured number to the matching SourceCardData (by `n`): for web cards make it an <a href={card.url} target="_blank">, for MCP/file cards make it a button that scrolls to and expands that card (lift openCitation up or use an id like `id={`src-${card.n}`}` on each card and href={`#src-${card.n}`}). At minimum add a title/hover tooltip showing the source title. This wires the promised [n]→card mapping the comments already assume.

4. **[high]** No 'searching the web' state — backend status events are dropped, generic dots shown instead
   - Web-search waiting UX (frontend) — `apps/web/app/page.tsx:581-670 (loop), :669 (comment), :201-219 (loading row); backend handler.go:242,247`
   - fix: In page.tsx's send() SSE loop, add an `else if (event === "status")` branch that reads parsed.phase and updates the loading row to a contextual label. Change the loading ChatMessage type to `{ id; role: "loading"; hint?: string }` (FeatureChat.tsx:39 already does exactly this) and render `m.hint` next to the dots using the existing `.msg-loading-hint` CSS class (dashboard.css:788). On phase 'retrieval' set hint to a new i18n string like s.searchingWeb ('Searching the web…' / 'جارٍ البحث في الويب…'); on 'reasoning' clear it or set s.generating. Add the new string to both locales in i18n.ts.

5. **[high]** Deep Research shows the same generic loader for tens of seconds with no progress indication
   - Web-search waiting UX (frontend) — `apps/web/app/page.tsx:864-874 (deepResearch chip), :542 (enableWebSearch: webSearch||deepResearch); backend handler.go:326-356, :421-441`
   - fix: Have the backend emit richer status events during the deepResearch fan-out (e.g. send('status', {phase:'searching', step:i, total:len(queries), query:q}) inside the loop at handler.go:336+), and have the new page.tsx status branch (from finding 1) render incremental progress (e.g. 'Searching sources 3/6…'). At minimum, set a distinct deep-research loading hint when deepResearch is on so the user knows a longer, multi-source process is running rather than a normal answer.

6. **[high]** Abort/net-drop leaves agent turn stuck on Working forever
   - Agent-mode step rendering — `page.tsx:716,726,691-692`
   - fix: try/finally: rewrite Working to Stopped if no terminal event.

7. **[high]** Empty assistant bubble (no spinner/dots) during Agent Mode's slowest phase — the planning / first tool call
   - MCP tool-call waiting UX (frontend) — `apps/web/app/page.tsx:715-716, 747; backend/internal/agent/agent.go:140-201`
   - fix: Either keep the loading row until the first `step`/`answer` arrives (don't replace it with an empty assistant message up front), or seed the assistant content with the working placeholder immediately: initialize `answer`/render to show `_${s.agentWorking}_` and call render() once before the read loop. Also add a `status` branch in runAgent's switch that surfaces phase:'planning' as a visible 'Planning…' line so the planning phase isn't silent.

8. **[high]** Stop is a no-op during the pre-stream window (controller not yet created) — button lies, request continues
   - Chat — Stop / abort UX — `apps/web/app/page.tsx:312-316 (stop), 469-561 (send); same shape in apps/web/app/features/[slug]/FeatureChat.tsx:235-240 & 255-336; apps/web/app/spaces/[id]/SpaceChat.tsx:173-177 & 192-249`
   - fix: Make stop() set an 'aborted' flag (e.g. a sendSeqRef token or a boolean ref) in addition to aborting, and have send() create the AbortController BEFORE the first await (right after setSending(true)), assign it to streamAbortRef, and pass its signal into spacesApi.context / chatsApi.create where possible. At minimum, after each pre-stream await in send() check 'if (controller.signal.aborted) { setMessages(cur => cur.filter(m => m.id !== loadingId)); return; }' so a Stop during the window actually halts the pipeline. Creating the controller up-front also lets stop() abort the space-context/chat-create fetches.

9. **[high]** Double-send race: `sending` guard is a stale closure with no synchronous lock
   - Composer send edge cases — `apps/web/app/page.tsx:450-469, 803-806, 1005-1011; same pattern in FeatureChat.tsx:242-255,539-543 and SpaceChat.tsx:179-192,363-367`
   - fix: Add a synchronous re-entrancy lock that doesn't depend on React state timing: a `useRef(false)` flag set true at the top of send() (after the early return) and cleared in the finally block, checked alongside `sending` in both send() and the keydown handler. e.g. `if (!text || sending || sendLockRef.current) return; sendLockRef.current = true;` and `finally { sendLockRef.current = false; }`.

10. **[high]** Long input silently truncated/dropped — text is cleared before the request can fail
   - Composer send edge cases — `apps/web/app/page.tsx:451,468 (setValue("") before fetch); backend/internal/api/handler.go:144 (maxChatBodyBytes 1<<20) and 538-546 (maxMsgContentLen 24000 truncation)`
   - fix: Only clear the composer after the fetch returns OK (or restore `value` in the catch block when `err.name !== 'AbortError'`). Add a client-side length guard that warns at ~24k chars (matching the server cap) rather than truncating server-side without feedback, and surface a specific 'message too long' message for the 400/413 case.

11. **[high]** FeatureChat ?model= deep-link prefill is unvalidated against the feature's modality
   - Model switch mid-conversation — `apps/web/app/features/[slug]/FeatureChat.tsx:112-126 (setModel(mdl) at :120); send body model:model at :307; generateMedia isVideo check at :434`
   - fix: Validate the prefill against the current group before applying it, e.g. `if (mdl && allModels.some((m) => m.id === mdl)) setModel(mdl);` (compute allModels before this effect, or inline the group lookup). Mirror the same guard anywhere `model` is sent: clamp to `currentModel.id` (the already-validated fallback) in the send body instead of the raw `model` state — exactly how page.tsx send() uses `currentModel.id` (page.tsx:532) rather than the persisted `model`.

12. **[high]** Soft keyboard hides the docked composer
   - Mobile chat UX — `apps/web/app/layout.tsx:91`
   - fix: Add interactiveWidget resizes-content to the viewport export and a visualViewport listener applying a keyboard padding-bottom inset to the composer.

13. **[high]** Home chat stage 56px too tall on mobile
   - Mobile chat UX — `apps/web/app/dashboard.css:458`
   - fix: Use flex 1 with min-height 0 on the stage and drop height 100dvh, or use calc 100dvh minus 56px at narrow widths.

14. **[high]** Code blocks (```fences```) are not pinned LTR — render right-aligned / bidi-reordered on Arabic pages
   - RTL / Arabic chat rendering — `apps/web/app/components/AssistantMessage.tsx:284 (CodeBlock <pre className="md-code">) + apps/web/app/dashboard.css:579-593 (.md-body pre), :709-724 (.md-code)`
   - fix: Force LTR on the code block. Either set `dir="ltr"` on the <pre> in CodeBlock (AssistantMessage.tsx:284) or add CSS `.md-code, .md-body pre { direction: ltr; text-align: left; unicode-bidi: isolate; }`. CSS is the cleaner fix and also covers the legacy `.md-body pre` path.

15. **[high]** Every streamed token re-parses the entire in-flight answer through react-markdown (O(n²) over answer length)
   - Performance & re-renders (chat streaming) — `apps/web/app/page.tsx:629-640 (delta handler) + apps/web/app/components/AssistantMessage.tsx:48-68; mirrored in FeatureChat.tsx:383-388 and SpaceChat.tsx:295-300`
   - fix: Coalesce deltas before committing to React state: buffer incoming text and flush to setMessages at most once per animation frame (requestAnimationFrame) or every ~50–80ms, instead of once per token. Optionally wrap the delta setMessages in React's startTransition. For the markdown cost specifically, memoize the parsed output per assistant message (e.g. useMemo on content inside AssistantMessageInner is already implicit via memo, but the real win is fewer, larger content updates). Throttling the flush turns O(N²) parses into O(N/flush-size · current-length) ≈ a small constant number of parses per second regardless of token rate.

16. **[high]** scrollIntoView({behavior:"smooth"}) fired on every token causes layout thrash and stacked scroll animations
   - Performance & re-renders (chat streaming) — `apps/web/app/page.tsx:193-196; apps/web/app/features/[slug]/FeatureChat.tsx:193-196; apps/web/app/spaces/[id]/SpaceChat.tsx:143-146`
   - fix: Use `behavior: "auto"` (instant) while streaming and reserve smooth only for the initial open, OR throttle the scroll to rAF and only call it when the user is pinned to the bottom. Simplest robust fix: keep a ref to the last scroll time and skip if <100ms since last; and drop "smooth" during active streaming. This pairs naturally with the delta-coalescing fix above (one flush per frame = one scroll per frame).

17. **[high]** Streaming answer live region re-announces the whole growing message token-by-token
   - Accessibility (Chat) — `apps/web/app/page.tsx:199 (also features/[slug]/FeatureChat.tsx:826, spaces/[id]/SpaceChat.tsx:534)`
   - fix: Don't live-announce the streaming node character-by-character. Render the in-flight assistant message with `aria-hidden` or outside the live region while streaming, and announce ONLY the final text once the `done` event lands by writing it into a dedicated visually-hidden `aria-live="polite"` status node (or set the assistant container to aria-live only after streaming finishes). At minimum drop `text` from aria-relevant (use `aria-relevant="additions"`) so only whole new message nodes — not intra-node edits — are announced.

18. **[high]** role="menu" popovers/model-pickers contain plain buttons & links, not menuitems
   - Accessibility (Chat) — `apps/web/app/page.tsx:888 and :967 (FeatureChat.tsx:603 and :690; SpaceChat composer popovers)`
   - fix: Either (a) drop `role="menu"` entirely and let these be a normal group of buttons/links (simplest and correct, since they already work via Tab + Enter), or (b) commit to the menu pattern fully: add `role="menuitem"` (or `menuitemcheckbox` for the web-search/agent toggles, `menuitemradio` for the model rows) to each child plus arrow-key roving tabindex. Option (a) is recommended.

19. **[high]** Focus is lost after sending via mouse click because the send button self-disables
   - Accessibility (Chat) — `apps/web/app/page.tsx:1002-1014 (Composer send button); same in FeatureChat.tsx:784-794, SpaceChat.tsx:~437`
   - fix: After a send dispatches, return focus to the composer textarea: call `taRef.current?.focus()` right after `setValue("")` in send(), and/or in the `finally` block. This keeps the conversation loop keyboard-driven and is what Claude/ChatGPT do.

20. **[high]** Refresh during streaming permanently loses the in-progress assistant answer
   - Message persistence & reload (chat) — `apps/web/app/page.tsx:673-682; FeatureChat.tsx:407-409; SpaceChat.tsx:336-338`
   - fix: Persist incrementally or on interruption: create the assistant chat_messages row when the first delta arrives and PATCH/UPDATE its content as it streams (add an append-or-update endpoint), OR flush a partial finalContent in the catch/finally and on `beforeunload`/AbortError so a half-streamed answer is saved rather than discarded. At minimum, persist finalContent in the AbortError branch when it's non-empty.

21. **[high]** Agent-mode replies on the home page are never persisted when the chat row doesn't pre-exist
   - Message persistence & reload (chat) — `apps/web/app/page.tsx:522-525, 703-778`
   - fix: Track a `synthetic`/`failed` flag in runAgent set in the error branch (767), and skip the chatsApi.append at 774 when set (mirror SpaceChat.tsx:264/310/336). Only persist genuine `answer` content.

22. **[high]** 401 mid-chat on the stream endpoint bypasses the global session watchdog — no redirect, user keeps typing into a dead session
   - Error states (frontend) — chat experience — `apps/web/app/page.tsx:555-564; apps/web/app/features/[slug]/FeatureChat.tsx:330-337; apps/web/app/spaces/[id]/SpaceChat.tsx:243-250; apps/web/app/lib/api.ts:42-43,88`
   - fix: Before throwing on `!r.ok`, check `if (r.status === 401) { /* call the same handler */ }`. Cleanest: export the `on401` handler (e.g. `notifyUnauthorized()` from lib/api.ts) and invoke it in all three stream sends when `r.status === 401`, then throw a friendly message. Also handle a 401 that arrives mid-stream (reader rejects) the same way.

23. **[high]** Home page persists "Error: …" SSE errors into chat history as a fake assistant turn
   - Error states (frontend) — chat experience — `apps/web/app/page.tsx:655-682`
   - fix: Match SpaceChat: track a `synthetic`/`isError` flag, render the error inline for the live turn, but skip `chatsApi.append` when the turn is an error (`if (activeChatId && finalContent !== "" && !synthetic)`). Standardize this across all three files.

24. **[high]** No retry/regenerate affordance and the typed prompt is destroyed on any failure
   - Error states (frontend) — chat experience — `apps/web/app/page.tsx:468,683-698; apps/web/app/features/[slug]/FeatureChat.tsx:254,415-424; apps/web/app/spaces/[id]/SpaceChat.tsx:191,339-348`
   - fix: On a non-abort failure, restore the draft (`setValue(text)`) so the user can re-send with one keystroke, OR render a Retry button on the failed/error assistant row that re-invokes send() with the original `text`. Prefer the latter so the transcript stays intact.

25. **[high]** "Open in Canvas" is a dead no-op on the public /try and /s pages (drawer never mounted)
   - Canvas / Artifacts in chat — `apps/web/app/components/AppShell.tsx:66-77 (Shell); apps/web/app/components/AssistantMessage.tsx:286-294; apps/web/app/try/page.tsx:148; apps/web/app/s/[id]/page.tsx:56`
   - fix: Mount <CanvasDrawer /> for the public branch too (e.g. render it alongside children in the PUBLIC_ROUTE branch of Shell), OR hide the 'Open in Canvas' button when no drawer host is present. Cleanest: in CodeBlock (AssistantMessage.tsx:286), only show the button when a real CanvasProvider+drawer is active — e.g. expose a `canvasEnabled` flag from useCanvas() that is false for the no-op stub, and have public pages render their own CanvasDrawer.

26. **[high]** History truncation can leave a leading assistant turn → Anthropic/Vertex 400 on long chats
   - Conversation context / history (backend) — `backend/internal/api/handler.go:552-555 (sanitiseChatRequest); consumed at client.go:273-278 (callAnthropic), :507-513 (streamAnthropic), :597-603 (streamVertexAnthropic)`
   - fix: After truncation, drop any leading non-user messages so the slice begins with a 'user' turn: e.g. `for len(msgs) > 0 && msgs[0].Role != "user" { msgs = msgs[1:] }` appended right after the maxChatMessages slice in sanitiseChatRequest. (Also add a test asserting the first surviving message is role 'user' for an odd-length user-terminated input.)

27. **[high]** Agent Mode receives no conversation history — every agent turn starts cold
   - Conversation context / history (backend) — `backend/internal/agent/agent.go:80-84 (agentReq), :143-146 & :356-359 (messages seeded with only system+task); frontend apps/web/app/page.tsx:707-713 (runAgent posts only {task, useMcps, locale})`
   - fix: Add an optional `Messages []llm.Message` (or `history`) to agentReq, have runAgent send the same filtered transcript the chat path sends, and seed the agent's messages array with the prior turns before the new user task (capped/sanitised the same way sanitiseChatRequest does). At minimum, pass the last few user/assistant turns so follow-ups resolve.

28. **[high]** Empty/failed web search still instructs the model to cite non-existent [n] sources (fabrication risk)
   - Web search (Brave) wiring (backend) — `backend/internal/api/handler.go:726-728, 851-863, 869`
   - fix: Track whether web search was requested and whether it yielded results. When `(req.EnableWebSearch || req.DeepResearch)` but the web-search citation set is empty, add an explicit instruction to buildSystem (independent of useMcps) like 'Web search was requested but returned no usable results; say so and answer only from general knowledge — do NOT emit [n] citations.' Also suppress/condition the DEEP RESEARCH 'cite every claim' block (line 727) when there are zero citations. Optionally emit an SSE warning event so the UI can show 'web search returned no results'.

29. **[high]** Deep Research runs searches strictly sequentially — ~90s worst-case retrieval with no progress feedback
   - Web search (Brave) wiring (backend) — `backend/internal/api/handler.go:336-363, 421-444, 242-247`
   - fix: Run the per-query braveSearch calls concurrently (bounded errgroup, e.g. 3-4 at a time to respect Brave's rate limit) instead of sequentially, and/or lower the per-query timeout for Deep Research. Emit incremental SSE progress (e.g. status events 'searching 2/6') from gather by threading the send callback in, so the UI can show live progress. Add an overall retrieval deadline so one slow query can't dominate.

30. **[high]** Untrusted-data fence markers (---END-USER-INSTRUCTIONS---, ---END-SPACE-MEMORY---) are not neutralized, allowing fence escape / prompt injection
   - System prompt construction (backend) — handler.go buildSystem — `backend/internal/api/handler.go:753-755, 824-828, 930-940`
   - fix: In stripFencesAndControlChars (or a dedicated helper used for fenced user content), also neutralize the literal marker lines: strings.ReplaceAll any occurrence of '---BEGIN-' / '---END-' (case-insensitive, allowing surrounding dashes) inside user content, e.g. replace a run of 3+ hyphens with a single hyphen, or specifically defang '---BEGIN' and '---END' to '- - -BEGIN'. Apply to both featureInstructions (line 754) and each memory entry (line 817).

31. **[high]** MCP 'connected sources' grounding block is dead/misleading — chat gather() no longer queries any connector, yet useMcps drives a 'returned NO usable content' message on most turns
   - System prompt construction (backend) — handler.go buildSystem — `backend/internal/api/handler.go:851-863, 303-320 (gather), apps/web/app/page.tsx:483,540`
   - fix: Either (a) hide/remove the connector pills from the chat composer now that chat-side MCP grounding is gone (page.tsx), or (b) in buildSystem stop emitting the MCP block for the chat path — drop the lines that reference 'connectors returned NO usable content' and 'connector's retrieval block' when no citation actually has an MCP source. Minimal backend fix: only print the useMcps block when at least one citation is a non-web, non-file source; otherwise omit it.

32. **[high]** MCP tool-level errors (result.isError) are misreported as successful observations + source cards
   - Agent loop correctness (backend) — `backend/internal/agent/agent.go:202-217 (execTool path) + 633-655 (CallRemoteTool) + backend/internal/connectors/remote.go:709-723 (remoteRPC)`
   - fix: Detect tool-level failure in CallRemoteTool/execTool. In remote.go after unmarshalling the result, check for a boolean `isError`==true (the MCP tools/call shape) and either return an error or surface a flag; simplest: in CallRemoteTool, decode result into a struct with `IsError bool` + `Content []...` and return an error (with the content text) when IsError is true, so execTool's existing 'tool error:' prefix path fires. Then ok=false, no source card is added, and the model sees it as a failed step.

33. **[high]** MCP tool-call errors (isError / content payloads) are treated as successes
   - MCP tool execution (backend) — remote.go JSON-RPC client + agent.go execTool — `backend/internal/connectors/remote.go:705-723 (remoteRPC), :573-584 (callRemoteTool), :637-656 (CallRemoteTool); backend/internal/agent/agent.go:633-637, :203-214`
   - fix: In remoteRPC (or callRemoteTool), after unmarshalling `result`, detect `isError:true` and surface the `content[].text` as an error. E.g. unmarshal result into `struct{ IsError bool `json:"isError"`; Content []struct{Text string `json:"text"`} `json:"content"` }`; if IsError, return an error built from the joined content text so execTool prefixes it with `tool error:` and the model/UI treat it as a failure.

34. **[high]** Live SSE agent run has no overall timeout; a slow/hung remote MCP server stalls the run with no feedback
   - MCP tool execution (backend) — remote.go JSON-RPC client + agent.go execTool — `backend/internal/agent/agent.go:122 (`ctx := r.Context()`), :172-219 (loop); backend/internal/connectors/remote.go:637-656 (CallRemoteTool passes ctx straight through), :573-584 (callRemoteTool: initialize THEN tools/call, each bounded only by oauthHTTP.Timeout=20s)`
   - fix: Add a per-call deadline inside CallRemoteTool/listRemoteTools (e.g. context.WithTimeout(ctx, 15*time.Second) like the 6s used in RemoteAgentTools) and/or wrap handleStream's ctx with an overall budget (e.g. context.WithTimeout(r.Context(), 2-3*time.Minute)). Emit a `step` observation with ok=false on deadline so the user sees the timeout.

35. **[high]** Mid-stream provider error events are silently swallowed — a truncated answer is returned as a successful completion
   - Backend SSE streaming (handler.go chat stream + agent.go agent stream + llm provider SSE parsers) — `backend/internal/llm/client.go:541-565 (streamAnthropic), 640-664 (streamVertexAnthropic), 765-793 (streamGoogle), 828-855 (streamOpenAI); backend/internal/llm/dashscope.go:146-173 (streamDashScope)`
   - fix: In each parser, decode the event/chunk `type`/`error` field. For Anthropic-family: if `evt.Type=="error"`, return the accumulated text together with a non-nil error (e.g. `fmt.Errorf("anthropic stream: %s", evt.Error.Type)`). For OpenAI/DashScope: detect a top-level `error` object in the chunk and return an error. Have CompleteStream surface that to ChatStream, which should send an `error` SSE event (after the deltas already sent) so the UI can flag the truncation rather than presenting it as complete.

36. **[high]** No SSE heartbeat/keep-alive during long silent windows (Deep Research gather, agent tool-discovery, blocking agent LLM rounds)
   - Backend SSE streaming (handler.go chat stream + agent.go agent stream + llm provider SSE parsers) — `backend/internal/api/handler.go:242-260 (gather before reasoning); backend/internal/agent/agent.go:140-141 (buildTools before first status) and 172-219 (ChatWithTools rounds)`
   - fix: Add a periodic comment-frame heartbeat. In the SSE handlers, start a `time.NewTicker(15*time.Second)` goroutine that writes `": ping\n\n"` + Flush while a real frame hasn't been sent, guarded by ctx and a mutex around the writer (or funnel all writes through a single channel/goroutine). At minimum send a `status` frame periodically during gather and before/after each agent round.

37. **[high]** Credits are charged on accept with no refund when the model request fails (partial/zero answer still billed)
   - Quota / credit enforcement mid-chat — `backend/internal/api/handler.go:73 (Record in checkQuota) + handler.go:274-282 (upstream-error branch); backend/internal/billing/billing.go:95-110 (Record, no Refund exists); agent path backend/internal/agent/agent.go:114 & 305`
   - fix: Charge on success, or refund on failure. Simplest: move `Record` to AFTER a successful stream (after handler.go:286/agent's final answer), keeping `Check` up front for the gate. If you must reserve up front, add `Service.Refund(userID, op)` (INSERT a negative-credit ledger row, or DELETE the just-inserted row by id) and call it in the upstream-error branches (handler.go:280, agent.go:176). Note: do NOT refund on client-disconnect mid-stream (handler.go:271) — partial tokens were delivered.

38. **[high]** Message order on reload is non-deterministic; can render the assistant turn BEFORE its user turn
   - Persistence integrity (backend) — `backend/internal/chats/chats.go:332-343 (ORDER BY) + :429-431 (INSERT, created_at defaults to now()); 001_init.up.sql:61 (created_at TIMESTAMPTZ DEFAULT now())`
   - fix: Add a monotonic per-chat ordering column instead of relying on now()+id. Either (a) add `seq BIGINT` populated from a per-chat counter inside the append transaction (`SELECT COALESCE(MAX(seq),0)+1 FROM chat_messages WHERE chat_id=$1 FOR UPDATE` then INSERT seq), ordering by seq; or (b) at minimum switch the INSERT to `clock_timestamp()` for created_at and have the frontend pass an explicit client sequence in meta. Order by (seq) / (created_at-from-clock_timestamp, seq), never by random id.

39. **[high]** User turn can be silently lost when chat creation succeeds but the user-append fails (no retry, no await, no error surfaced)
   - Persistence integrity (backend) — `apps/web/app/page.tsx:516-518 and :676-682; FeatureChat.tsx:279-281,407-409; SpaceChat.tsx:213-215,336-338`
   - fix: Persist the turn pair atomically: either await the user-append before starting the stream (and surface a non-blocking 'couldn't save this message' toast on failure), or add a backend endpoint that accepts the user+assistant pair (or the user turn at stream-start) in one transaction. At minimum, retry the append once and toast on persistent failure so the user knows history may be incomplete.

---

## 1. Streaming, auto-scroll & message rendering

This section covers how answers stream in, how the chat auto-scrolls (a specific user pain point), the loading/waiting state, markdown + citations rendering, and per-token re-render performance. Findings are de-duplicated across agents and ordered by impact. Line references are from the three chat surfaces — home (`apps/web/app/page.tsx`), `apps/web/app/features/[slug]/FeatureChat.tsx`, and `apps/web/app/spaces/[id]/SpaceChat.tsx` — which share the same design, plus the shared `apps/web/app/components/AssistantMessage.tsx`.

### P0 — The single biggest jank source: smooth auto-scroll on every token

**The chat scrolls on its own and never settles.** Every streamed SSE delta fires `endRef.scrollIntoView({ behavior: "smooth", block: "end" })` from a `useLayoutEffect` on `[messages]`. `behavior:"smooth"` is a ~300ms animation; when tokens arrive faster than that (the common case), each animation is interrupted and restarted before it lands, so the viewport perpetually rubber-bands, lags behind the true bottom, and never settles. This is the "chat scrolling on its own" feel the user dislikes, and because it runs in `useLayoutEffect` it also forces a synchronous layout on every token, compounding the markdown re-parse cost.

- **Location:** `apps/web/app/page.tsx:193-196`; `apps/web/app/features/[slug]/FeatureChat.tsx:193-196`; `apps/web/app/spaces/[id]/SpaceChat.tsx:143-146`
- **Fix:** Switch the per-token follow scroll to `behavior:"auto"` (instant). Reserve `"smooth"` only for the one-time scroll when a brand-new user/loading row is appended (detect via a ref tracking the last message id/count). Pairs naturally with the delta-coalescing fix in P1 below — one flush per frame becomes one scroll per frame. This is the highest-leverage single change in the whole section and most directly answers the user's complaint. Agent Mode (`page.tsx:724-772`) rides this same effect and is the worst case (large height deltas per step), so verify it specifically after the fix.

### P0 — Per-token re-parse of the entire growing answer (O(n²) markdown work)

Every delta triggers `setMessages` → parent re-render → react-markdown re-parses the **entire** in-flight answer. `React.memo` on `AssistantMessage` correctly protects prior turns, but does nothing for the one message actively streaming — which is exactly the one growing large. On long/code-heavy answers the main thread spends increasing time per token, so streaming visibly slows and stutters as the answer grows.

- **Location:** delta handler `apps/web/app/page.tsx:629-640` feeding `apps/web/app/components/AssistantMessage.tsx:48-68`; mirrored in `FeatureChat.tsx:383-388` and `SpaceChat.tsx:295-300`
- **Fix:** Coalesce deltas before committing to React state — buffer incoming text and flush to `setMessages` at most once per animation frame (`requestAnimationFrame`) or every ~50–80ms instead of once per token. Optionally wrap the delta `setMessages` in `startTransition`. This turns O(n²) parses into a small constant number of parses per second regardless of token rate, and (combined with P0 scroll) yields one scroll + one parse per frame.

### P1 — No streaming indicator after the loader is replaced; loader drops too early

Two related gaps leave the user staring at apparent dead air:

1. **The loader is removed at response-headers time, not first-token time.** Between headers and the first token (model TTFT can be several seconds, far longer when web search / Deep Research ran first), the three-dot loader vanishes and the user sees an empty assistant bubble — it looks like the app froze or returned nothing.
   - **Location:** `apps/web/app/page.tsx:566-573`; `FeatureChat.tsx:339-342`; `SpaceChat.tsx:252-255`
   - **Fix:** Keep the loading row mounted until the **first** `delta`/`content` event actually arrives, then swap (filter `loadingId` and insert the assistant row in the same `setMessages` on the first delta).

2. **No "still streaming" cursor once the real message shows.** After the placeholder is swapped out there is no signal the model is still typing; if the provider stalls between tokens, a half-finished answer is indistinguishable from a completed one.
   - **Location:** `apps/web/app/page.tsx:566-573` and `components/AssistantMessage.tsx:35-79` (no `isStreaming` prop)
   - **Fix:** Pass an `isStreaming` boolean to the currently-streaming `AssistantMessage` (true until `done`/`content`/AbortError) and render a blinking caret after the markdown body via a `.md-body--streaming::after` rule.

### P1 — No "jump to latest" affordance, and autofollow can silently disengage

The stick-to-bottom design (a ref flips false when the user scrolls >120px from the bottom) is sound, but has three compounding gaps:

1. **No "scroll to bottom / jump to latest" button once the user scrolls up.** The only way to re-engage autofollow is to manually scroll back within 120px. A user who scrolls up to re-read a long streaming answer gets no signal new content is arriving and no one-tap return — content piles up below the fold. Every major competitor shows a floating down-arrow pill here.
   - **Location:** `apps/web/app/page.tsx:166-241`; `FeatureChat.tsx:482-494`; `SpaceChat.tsx:451-475`
   - **Fix:** Track bottom state in React state (`const [atBottom, setAtBottom] = useState(true)` updated in `onScroll`). When `!atBottom`, render a floating button over the transcript that scrolls `endRef` into view and re-sets the stick ref to true; optionally badge it when new tokens arrived while scrolled up.

2. **Growing `scrollHeight` during the smooth animation can spuriously disable autofollow mid-stream.** There is no flag distinguishing programmatic from user scrolling, and the 120px window is measured against a moving `scrollHeight`, so autofollow can silently switch off on a fast stream.
   - **Location:** `apps/web/app/page.tsx:185-189`; `FeatureChat.tsx:185-189`; `SpaceChat.tsx:132-135`
   - **Fix:** Set a `programmaticScrollRef = true` immediately before `scrollIntoView` and have `onScroll` ignore events while it's set (clear on scroll-idle / `scrollend`). Switching to `behavior:"auto"` (P0) also largely closes this race by removing the animation window. Do both.

3. **Autofollow fights a user reading upward within the 120px dead-zone.** With per-token retargeting, a user who starts scrolling up but hasn't crossed 120px is repeatedly pulled back down.
   - **Location:** `apps/web/app/page.tsx:187-195`; `FeatureChat.tsx:187-195`; `SpaceChat.tsx:134-145`
   - **Fix:** Once `scrollTop` decreases vs. the last known value in `onScroll`, set the stick ref false immediately regardless of the 120px window; re-enable only when the user returns within threshold. The first upward gesture should win.

### P1 — No contextual "thinking" feedback (web search / Deep Research)

The backend already emits `status` phase events (`{"phase":"retrieval"}` → `{"phase":"reasoning"}`) around the Brave/Deep-Research call, but all three frontends explicitly ignore them (`page.tsx:669` comment: "'status' + 'done' are advisory only"). So a Deep Research run — an LLM query-expansion call plus up to 6 serial ~12s Brave searches — shows the same generic 3-dot loader as a fast reply for tens of seconds, with no "Searching the web…/Researching…" feedback. Users will assume it hung and abort or double-send.

- **Location:** SSE loop `apps/web/app/page.tsx:581-670` (ignore comment at `:669`); backend emits at `handler.go:242,247`. The hint UI already exists and is styled (`FeatureChat.tsx:39` loading type carries `hint?`, rendered via `.msg-loading-hint`, `dashboard.css:786-792`) but is only wired for media generation.
- **Fix:** Add an `else if (event === "status")` branch in each send loop that sets the loading row's `hint` from `parsed.phase` (retrieval → `s.searchingWeb` / `s.researching` when Deep Research is on; reasoning → clear or `s.generating`), reusing the existing `hint` field. Add the localized strings to `i18n.ts`. For Deep Research specifically, have the backend emit incremental progress (`status` with `step/total`) so the UI can show "Searching sources 3/6…".

### P2 — Markdown rendering polish

The pipeline is fundamentally solid and safe: react-markdown 9 + remark-gfm with **no** rehype-raw (raw HTML is escaped, no markdown-driven XSS), and `safeUrlTransform` strips `javascript:`/`data:`/protocol-relative URLs and forces `target=_blank rel=noopener`. The gaps are polish:

- **GFM task-list checkboxes render with stray list bullets.** Models frequently emit task lists for plans/checklists (Agent Mode encourages them); they render with both a default bullet and the checkbox, misaligned — looks broken vs. competitors.
  - **Location:** `apps/web/app/dashboard.css:564` (`.md-body ul/ol`), no `.task-list-item`/`.contains-task-list` rule; markup from `AssistantMessage.tsx:48-49`
  - **Fix:** Add `.md-body ul.contains-task-list { list-style:none; padding-inline-start:0; }`, `.md-body li.task-list-item { display:flex; align-items:flex-start; gap:8px; }`, `.md-body li.task-list-item input[type=checkbox] { margin-top:4px; }`.

- **Code blocks never show their language label** (plain monospace, no highlighting → multi-language answers read as undifferentiated gray blocks).
  - **Location:** `apps/web/app/components/AssistantMessage.tsx:261-262, 283-306` (CodeBlock)
  - **Fix:** When `lang` is truthy, render a small `.md-code-lang` label inside `.md-code-actions`. Purely additive. (Full syntax highlighting via rehype-highlight/Shiki is an acknowledged deferral, lower priority.)

- **Copy / Open-in-Canvas buttons scroll out of view on horizontally-scrolling code blocks** — the Copy button becomes unreachable on wide code.
  - **Location:** `apps/web/app/dashboard.css:709-716` (`.md-code`), `:954-955` (`.md-code-actions`)
  - **Fix:** Wrap `<pre>` in a `position:relative` div and place `.md-code-actions` on that wrapper (or make it `position:sticky; inset-inline-end:8px`).

- **Copy fallback can prepend button labels** ("Open in CanvasCopy…") to copied code in the fallback path, silently corrupting the snippet.
  - **Location:** `apps/web/app/components/AssistantMessage.tsx:266`
  - **Fix:** Scope the fallback to the inner `<code>` (`ref.current?.querySelector('code')?.innerText`) not the whole `<pre>`.

### P2 — Inline `[n]` citation markers are inert plain text

The citation rail is solid (shared flatten/number ordering with the backend, clickable web cards with favicon+snippet, expandable MCP/file previews). But the inline `[n]` markers the model writes are rendered as plain text with no click-through, hover, or scroll-to-source — despite code comments and the system prompt promising that mapping. On long answers the rail may be scrolled far away, defeating the purpose of numbering.

- **Location:** `apps/web/app/components/AssistantMessage.tsx:45-69` (ReactMarkdown render), `:82-124` (`normaliseCitations`); backend prompt `handler.go:872-880`
- **Fix:** Add a text/`p` post-processor (or rehype plugin) that scans rendered text for `/\[(\d+)\]/` and replaces each with an anchor/button mapped to the matching `SourceCardData` by `n`: web cards → `<a href={card.url} target="_blank">`, MCP/file cards → a button that scrolls to and expands that card (give each card `id={`src-${card.n}`}`). At minimum add a `title` tooltip with the source title.

Two smaller, lower-priority citation correctness issues worth folding in:
- Expand/collapse state is keyed by array index, so an expanded preview can open the wrong card if the citation set changes — key by `card.n` instead (`AssistantMessage.tsx:42, 74-75, 172-205`).
- A web card with an empty URL renders as `<a href="">` and reloads the page on click; guard with `href={card.url || undefined}` (`AssistantMessage.tsx:100-112, 143-168`). Not reachable from a fresh stream (backend filters empty URLs) but reachable from arbitrary stored JSON on reload.

### P2 — Composer subtree re-renders on every streamed token

Because `messages` state is lifted to the parent and the composer isn't isolated, the composer subtree (including the full model list when the popover is open) reconciles on every token even though none of its inputs changed. On Feature/Space pages it's worse — the entire page subtree (model picker rows, media-control chips, aspect/seed inputs) re-renders per token because the composer was never split out.

- **Location:** home — `apps/web/app/page.tsx:84, 147-157, 244-258` (Composer is a plain, non-memoized function receiving the whole `messages` array); Feature/Space — `FeatureChat.tsx:69` + render `482-800`, `SpaceChat.tsx:43` + `composerInner 355-449`
- **Fix:** Wrap the composer in `React.memo` and stop passing it the whole `messages` array — it only needs `messages` inside `send()`, so read it via a ref. On Feature/Space, extract the composer into a separate memoized component that does not receive `messages`, mirroring the page.tsx Transcript/Composer split. Then a streaming `setMessages` only re-renders the transcript. Largely resolved by, and pairs with, the delta-coalescing fix in P0.

### Lower-priority / accept-for-now

- **Partial-markdown re-parse flicker during streaming** (unclosed `**` shows literal asterisks then snaps to bold; half-streamed ``` fence reflows). Inherent to per-token re-parse; the P0 delta-coalescing fix reduces it. Optionally auto-close dangling fences/emphasis before parsing the interim string. (`AssistantMessage.tsx:48-68`)
- **`aria-live` transcript re-announces the entire growing message on every token** — the streaming body is inside a `role="log" aria-live="polite"` region, so screen readers re-read the mutating paragraph hundreds of times (unusable SR flood). Fix: don't live-announce the streaming node token-by-token — render it `aria-hidden` during stream and announce the final text once into a dedicated visually-hidden polite region, or at minimum use `aria-relevant="additions"`. (`page.tsx:199`, `FeatureChat.tsx:826`, `SpaceChat.tsx:534`) — this is an accessibility-section item but originates in the streaming path.
- **A delta frame that fails `JSON.parse` is silently dropped** (token lost, no warning). Low probability since the backend JSON-marshals deltas. Fix: at minimum `console.warn` on parse failure. (`page.tsx:617-618, 629-640`)
- **The final canonical `content` event is ignored whenever any delta arrived**, so display/persistence keeps the delta-concatenation and never reconciles to the provider's canonical `full` string (whitespace normalization, corrective final text). The backend's reconciliation path is effectively dead for the streaming case. Fix: on `content`, if non-empty and different, replace `finalContent` once at end-of-stream. (`page.tsx:641-654` vs `handler.go:283-286`)

---

## 2. Conversation context, web search, MCP tool-calls & Agent Mode

This section covers the four pipelines that determine whether the model actually *knows* what came before, can *reach the live web*, can *act in a user's connected apps*, and can *reason in a multi-step loop* — plus what the user sees while each runs. The good news first: prior-message context **is** delivered to the model for normal chat (all three frontends send the full alternating transcript, and `handler.go` forwards `req.Messages` verbatim to every provider with correct role mapping), the Brave wiring is clean (typed "not configured" error, 5-min cache, dedup-by-URL, 16-source cap, citation numbering matched front-to-back), and the agent's plan→act→deliver loop is well-bounded (5-iteration cap, forced final synthesis, per-tool error isolation, panic recovery). The defects below are the gaps between that solid skeleton and a correct, trustworthy product.

### P0 — Correctness: the model is fed wrong data or none

These produce *silently wrong answers* — the worst failure class because the user cannot tell.

**2.1 — MCP tool-level errors are reported as successes (fed to the model + shown as a source card).**
`backend/internal/connectors/remote.go:705-723` (`remoteRPC`), `:637-656` (`CallRemoteTool`); `backend/internal/agent/agent.go:202-217`, `:633-637`. When a remote MCP tool legitimately fails the spec-correct way (`result.isError:true` — auth expiry mid-run, bad args, permission denied, rate limit), the code never inspects `isError`. The error payload is returned as a normal observation: the user sees a green ✅ and a "source card", and the model synthesizes its final answer from an error string presented as data. This defeats the exact "never fabricate tool results" rule the system prompt enforces, and it hits *every* compliant remote server.
**Fix:** In `CallRemoteTool`/`remoteRPC`, decode `result` into `struct{ IsError bool \`json:"isError"\`; Content []struct{ Text string \`json:"text"\` } \`json:"content"\` }`; when `IsError`, return an `error` built from the joined content text so `execTool`'s existing `tool error:` path fires — then `ok=false`, no source card is added, and the model sees a failed step.

**2.2 — Agent Mode receives ZERO conversation history.**
`backend/internal/agent/agent.go:80-84`, `:143-146`, `:356-359` (messages seeded with only system+task); frontend `apps/web/app/page.tsx:707-713` posts only `{task, useMcps, locale}`. Agent Mode runs inside the same transcript UI as chat, so follow-ups ("now do the same for the other repo", "summarize that") are natural — but the agent has no memory of any prior turn and either re-asks or guesses. Looks like the agent "forgot."
**Fix:** Add an optional `Messages []llm.Message` to `agentReq`; have the frontend send the same filtered transcript the chat path sends; seed the agent's messages array with prior turns before the new task (sanitised/capped the same way as chat).

**2.3 — Mid-stream provider error events are silently swallowed; a truncated answer is returned as success.**
`backend/internal/llm/client.go:541-565` (`streamAnthropic`), `:640-664` (`streamVertexAnthropic`), `:765-793` (`streamGoogle`), `:828-855` (`streamOpenAI`); `backend/internal/llm/dashscope.go:146-173`. When a provider emits a mid-stream `error` event, the parser ignores it and returns the accumulated text with `err==nil`, so `handler.go:286` fires `send("content")` + `send("done")` and the frontend persists a half-answer as a normal turn. Worst on exactly the long Opus/Deep-Research answers most likely to hit provider overload.
**Fix:** Decode the event `type`/`error` field in each parser; on an `error` event return the accumulated text plus a non-nil error. `CompleteStream`→`ChatStream` should then emit an SSE `error` event after the already-sent deltas so the UI can flag truncation instead of presenting it as complete.

**2.4 — Empty/failed web search still tells the model to cite non-existent `[n]` sources (fabrication risk).**
`backend/internal/api/handler.go:726-728`, `:851-863`, `:869`. When Web search / Deep Research is on but Brave returns nothing (rate-limited, bad key, network), the system prompt still instructs "cite `[n]` on every claim" with zero sources present — and the Deep Research block (`:726-728`) still says "cite across ALL numbered sources / finish with a Sources list" even when `len(citations)==0`. This invites fabricated citations, the precise failure the grounding rules exist to prevent.
**Fix:** Track requested-vs-yielded. When `(EnableWebSearch || DeepResearch)` and the web citation set is empty, inject an explicit "search returned no usable results — say so and answer from general knowledge, do NOT emit `[n]`" instruction and suppress the Deep Research cite/Sources wording. Optionally emit an SSE warning so the UI can surface "web search returned no results."

### P1 — Trust & feedback: the user can't tell what's happening

**2.5 — No "searching the web" state — backend `status` events are thrown away.**
Frontend: `apps/web/app/page.tsx:669` ("`status` + `done` are advisory only") and `:201-219` (loading row); backend already emits `{"phase":"retrieval"}`→`{"phase":"reasoning"}` at `handler.go:242,247`. With Web search ON the user sees the identical generic three-dot loader as a plain reply — no signal Brave is running, no confirmation the toggle engaged. The hint plumbing already exists and is styled (`FeatureChat.tsx:39` loading type with `hint?`, `.msg-loading-hint` at `dashboard.css:788`) but is wired only for media generation, never for search.
**Fix:** Add an `else if (event === "status")` branch in all three send loops that sets the loading row's `hint` from `parsed.phase` (`retrieval` → `s.searchingWeb` / `s.researching` when Deep Research; `reasoning` → clear or `s.generating`). Change the home loading `ChatMessage` type to carry `hint?` (FeatureChat already does). Add the i18n strings to both locales and also drive the dots' `aria-label` from the phase so screen-reader users aren't told "Generating" during retrieval.

**2.6 — Deep Research: tens of seconds of silence, plus sequential fan-out makes it worse.**
Frontend `apps/web/app/page.tsx:864-874`, `:542`; backend `handler.go:336-363`, `:421-444`. Deep Research runs up to 6 Brave queries **strictly sequentially** (~90s worst case, still inside the chi 5-min timeout so it isn't even cut off), behind a single static "retrieval" status, with no per-search progress. Users assume it hung and abort or double-send. Competitors show a live source-by-source list here.
**Fix:** Two parts. (a) Backend: run the per-query `braveSearch` calls concurrently via a bounded errgroup (3–4 at a time to respect Brave's rate tier) and thread the `send` callback into `gather` so it emits incremental `status` events (`{phase:"searching", step:i, total:n, query:q}`). (b) Frontend: render that progress in the status branch from 2.5 ("Searching sources 3/6…"). At minimum set a distinct Deep-Research loading hint so the longer process is visibly different from a normal answer.

**2.7 — No Brave 429 handling; Deep Research's burst exceeds the free 1 req/s tier and silently loses sub-queries.**
`backend/internal/api/handler.go:343-349`; `backend/internal/api/brave.go:76-78`. On the free Brave plan, several Deep Research sub-queries are dropped to rate limiting and the user is never told the research was partial.
**Fix:** Detect `res.StatusCode==429` in `braveSearch`, return a typed `rateLimited` error; add a small inter-query delay/token-bucket plus a single bounded retry honoring `Retry-After`; surface a "partial results (rate limited)" signal so the prompt/UI can note incompleteness. (Pairs naturally with the concurrency change in 2.6 — bound the errgroup to stay under the tier.)

**2.8 — Empty/blank assistant bubble during the agent's slowest phase (planning / first tool call), and the `status` event is ignored.**
Frontend `apps/web/app/page.tsx:715-716`, `:747`, `:730-771` (`runAgent` handles only step/answer/sources/error); backend emits `send("status", {phase:"planning", tools: len(tools)})` at `agent.go:141`. Between fetch-resolve and the first tool action (remote `tools/list` + first LLM round — often many seconds) the user stares at a *completely blank* assistant bubble: no dots, no "Working…", no "Planning…". The three-dot loader the normal chat keeps until first token was deliberately discarded on the agent path, and the deliberately-sent planning signal is dropped.
**Fix:** Add a `status` branch to `runAgent`'s switch: on `phase:"planning"` show a "Planning…" placeholder, and keep a working state visible before the first `step`/`answer`. Either keep the loading row mounted until the first event, or seed the assistant content with `_${s.agentWorking}_` and call `render()` once before the read loop.

**2.9 — A mid-execution tool call looks identical to a finished one — no per-tool running indicator.**
`apps/web/app/page.tsx:747-759`. Each tool execution (remote JSON-RPC bounded only by the ~20s client timeout, across up to 5 rounds) renders a static bullet that already looks complete. Users watch a frozen-looking list for tens of seconds with no heartbeat, unable to tell working from stuck.
**Fix:** Track the last action step as `pending` and render an in-flight marker (animated `…`/spinner) on the bullet that has no observation yet; swap to ✅/⚠️ when the observation arrives. Cleanest as a small dedicated step component rather than a markdown string.

**2.10 — No connectors → agent silently answers from base knowledge with zero signal.**
`backend/internal/agent/agent.go:517-554`, `:676-678` (tools==0 path); frontend `page.tsx:711`, `:747-771`. In Agent Mode with no connected remote servers, the run is indistinguishable from regular chat — connector chips silently no-op, no "no tools ran" notice, even though the backend knows `tools==0` (it ships it in the planning status). Probed reality from the deploy notes: of the operator's 6 connectors only Slack actually hosts a remote MCP server, so the zero-tools case is common in practice.
**Fix:** In the `status` branch from 2.8, when `tools===0` surface a hint ("No connectors connected — answering from model knowledge"). Optionally disable Agent Mode entirely when the user has no connected remote servers so the toggle never silently degrades.

### P2 — Polish, debuggability, and resilience

**2.11 — Raw machine identifiers and raw error strings leak into the agent work-log.**
`apps/web/app/page.tsx:748`, `:750-757`; `backend/internal/agent/agent.go:201`, `:533`, `:574-580`, `:206-211`, `:633-641`. The only place a user watches an external app being called shows (a) the opaque internal tool name `r<shorthex>__<tool>` — hex-prefixed, non-charset chars rewritten to underscores — instead of a friendly "Notion · search", and (b) raw upstream `tool error: …` strings (the chat handler deliberately scrubs these; the agent path does not). It reads like a bug and is a mild info-leak.
**Fix:** Backend: attach a friendly display name to the action step (reuse the `refs`/`addSource` connector-name resolution + real tool name) and map known failures to friendly observations ("couldn't reach Notion", "not connected — reconnect in Connectors"), stripping the internal `tool error:` sentinel before streaming; keep raw text in server logs only. Frontend minimum: split `parsed.tool` on `__`, strip the `r<hex>` prefix, and strip a leading `tool error: ` from the preview.

**2.12 — Raw query/preview text corrupts the rendered step markdown.**
`apps/web/app/page.tsx:748`, `:755-757`. Tool I/O containing backticks, brackets, or hashes is interpolated directly into the markdown step string, breaking the rendered list. (On RTL/Arabic pages the same line also garbles under bidi reordering — the leading `- 🔧`, the LTR tool id, neutral `:`/`↳`, and Arabic query text interleave.)
**Fix:** Escape markdown or wrap machine tokens (tool id, preview) in inline-code / bidi-isolated spans before interpolation.

**2.13 — Source cards: inline `[n]` markers are inert, and Agent Mode produces duplicate connector cards.**
`apps/web/app/components/AssistantMessage.tsx:45-69`, `:82-124` (markers rendered as plain text — no click-through, hover, or scroll-to-source, despite the system prompt at `handler.go:872-880` promising the mapping); `backend/internal/agent/agent.go:153-170` (`addSource` emits one card per call, so the same connector repeats with different `[n]` and identical icons).
**Fix:** (a) Post-process rendered text for `/\[(\d+)\]/` and replace with an anchor (web → `<a href={card.url}>`; MCP/file → button that scrolls to `id="src-${card.n}"`). (b) Dedup `addSource` by connector name (merge results) or pass a richer distinguishing label (`notion · search`) so duplicate cards are visually distinct.

**2.14 — Run-level resilience: no SSE heartbeat, no overall agent timeout, no client watchdog.**
Backend: `handler.go:242-260` (silent `gather` window), `agent.go:140-141`, `:172-219` (no keep-alive across tool-discovery and blocking LLM rounds), `:122` (agent `ctx` is just `r.Context()`); remote `remote.go:637-656`, `:573-584` (per-call bounded only by the 20s `oauthHTTP.Timeout`). Frontend: `page.tsx:703-773` (only a manual Stop). Any silent window >~60s gets killed by ingress-nginx/LB idle timeouts mid-stream — the exact long-running flows the product markets (Deep Research, Agent Mode) — and a hung remote server stalls a run with the UI frozen on the last step.
**Fix:** (a) Add a 15s comment-frame heartbeat (`": ping\n\n"` + Flush, guarded by ctx and a writer mutex) in both SSE handlers during silent windows. (b) Add a per-call deadline inside `CallRemoteTool`/`listRemoteTools` (e.g. `context.WithTimeout(ctx, 15s)`) and an overall run deadline (e.g. 2–3 min) on `handleStream`; emit a `step` observation with `ok=false` on timeout. (c) Add an inactivity watchdog in `runAgent` (~45–60s no-frame → abort + "agent stopped responding" toast).

**2.15 — SSRF: stored remote MCP server URL is never re-validated before outbound calls.**
`backend/internal/connectors/remote.go:248-251` (`validHTTPSURL` checks only scheme/host/length), `:573-584`, `:682-708`, `:466`/`:649` (URL persisted and reused from DB). An authenticated user can register a "remote MCP server" URL pointing at internal infra (cloud metadata endpoint, in-cluster services reachable from the pod) and trigger server-side requests to it from the agent/tools-list paths.
**Fix:** Resolve the host and reject private/link-local/loopback/metadata ranges before the first request, and re-check after redirects via a custom `CheckRedirect`; apply at `handleRemoteStart` **and** at call time (DNS can change — TOCTOU), or maintain a host allowlist.

**2.16 — Failed token refresh returns a stale token; 401s never trigger a reconnect signal.**
`backend/internal/connectors/remote.go:466-489` (`remoteAccessToken` swallows refresh failure, returns the expired token, doesn't log); error surfacing at `agent.go:633-636`, `remote.go:706-707`, `:719-721`. A failed refresh produces a confusing downstream 401 the user can't diagnose, with no "reconnect needed" prompt and nothing in the logs for the operator.
**Fix:** Change `remoteAccessToken` to return `(string, error)`, log the refresh failure, and have callers skip the connector / return "reconnect required"; treat a remote 401 as a connection-invalid signal (mark `connected=false` / flag for re-auth) and include a truncated body snippet + JSON-RPC error message in surfaced errors.

**2.17 — Lower-severity hardening (grouped):**
- **History truncation can leave a leading assistant turn → Anthropic/Vertex 400 on long chats** (`handler.go:552-555`, consumed at `client.go:273-278`/`:507-513`/`:597-603`). After the `maxChatMessages` slice, drop leading non-user turns: `for len(msgs)>0 && msgs[0].Role!="user" { msgs = msgs[1:] }`. Intermittent-looking ("works at 99 turns, breaks at 101").
- **Per-message truncation splits UTF-8 runes**, corrupting Arabic/CJK history (`handler.go:544-546`). Replace `m.Content[:maxMsgContentLen]` with the rune-safe `capForBudget` already in the file; apply to the `agent.go` task truncations too.
- **Tool-name namespacing can collide across two remote connectors, silently dropping a tool** (`agent.go:533-539`, `:558-567`). Index connectors by position (`c0/c1/…`) or include enough UUID to be unique; log on collision instead of `continue`.
- **`extractJSONRPC` takes the LAST `data:` line**, which may be a notification rather than the response (`remote.go:727-741`). Select the message whose `id` matches the request and that has `result`/`error`; skip notifications.
- **Deep Research `extra_snippets` is parsed but never requested or used** (`brave.go:36,53-57`; `handler.go:888-891`) — dead code and a missed grounding-quality win. Either remove the field or request `extra_snippets=true` and append into the per-source block.
- **Agent budget is checked once up front but never across its ~6 LLM rounds** (`agent.go:104-115`, `:300-306`) — one "agent" credit buys up to 6× the LLM work; re-check before each round or price accordingly.

### Note on scope (deliberately excluded here)
The chat-side "connected sources" system-prompt block is **dead/misleading**: `gather()` no longer queries any MCP for normal/feature/space chat (only Brave + uploaded Space files), yet `useMcps` still drives a "those connectors returned NO usable content" message on most turns (`handler.go:851-863`, `page.tsx:483,540`). The clean fix is to hide the connector pills from the *chat* composer (MCP grounding only exists in Agent Mode now) **or** stop emitting the MCP block unless a citation actually has a non-web/non-file source. This is logged in the system-prompt section; flagged here because it's the root reason users think connectors "work" in plain chat when they don't.

---

## 3. UX, waiting feedback, errors, mobile/RTL, accessibility & persistence

This section consolidates confirmed defects in the chat experience across waiting states, errors, mobile + Arabic RTL, accessibility, and persistence. The three chat surfaces — home `apps/web/app/page.tsx`, `apps/web/app/features/[slug]/FeatureChat.tsx`, `apps/web/app/spaces/[id]/SpaceChat.tsx` — share most of this code, so nearly every frontend fix must be applied in all three. References use the `file:line` ranges reported by the analysis agents.

### 3.1 Critical (data loss, broken core promises, security)

**C1. Stop button is a no-op during the pre-stream window — the request continues and a full answer lands anyway.**
`page.tsx:312-316` (stop) + `:469-561` (send); `FeatureChat.tsx:235-240` + `:255-336`; `SpaceChat.tsx:173-177` + `:192-249`. The `AbortController` is created only *after* several awaits (space-context fetch, lazy chat creation, the fetch handshake). Clicking Stop in that window flips the button back to Send while the request keeps running, creates the chat, streams the full answer, persists the turn, and charges quota — the core Stop promise is broken for exactly the slowest, most-likely-to-be-cancelled requests.
**Fix:** Create the controller before the first await (right after `setSending(true)`), assign to `streamAbortRef`, and after each pre-stream await check `if (controller.signal.aborted) { remove loadingId; return; }`. Have `stop()` also set an aborted ref so the window is covered synchronously.

**C2. Double-send race — the `sending` guard is a stale closure with no synchronous lock.**
`page.tsx:450-469, 803-806, 1005-1011`; `FeatureChat.tsx:242-255, 539-543`; `SpaceChat.tsx:179-192, 363-367`. Enter-twice, or Enter-then-click, fires the same message twice → duplicate transcript turns, duplicated persisted history, double quota charge. The button is only `disabled` when empty; the Enter path has no disable at all.
**Fix:** Add a synchronous `useRef(false)` re-entrancy lock set at the top of `send()` (after the early return) and cleared in `finally`, checked in both `send()` and the keydown handler. React `sending` state flips too late to guard same-tick double submits.

**C3. Long input silently truncated/dropped — and the composer is cleared before the request can fail.**
`page.tsx:451, 468` (`setValue("")` before fetch); backend `handler.go:144` (`maxChatBodyBytes 1<<20`), `:538-546` (`maxMsgContentLen 24000` truncation). Pasting >24k chars yields a silently truncated answer; >1 MB throws a generic error AND loses the entire input because the box was already cleared. Typed content is unrecoverable.
**Fix:** Only clear the composer after the fetch returns OK, or restore `value` in the catch when `err.name !== 'AbortError'`. Add a client-side length warning at ~24k matching the server cap, and a specific "message too long" message for 400/413.

**C4. Refresh/disconnect during streaming permanently loses the in-progress assistant answer.**
`page.tsx:673-682`; `FeatureChat.tsx:407-409`; `SpaceChat.tsx:336-338`. Persistence is frontend-driven, fire-and-forget. If the user refreshes or the network drops mid-stream, the user message is saved but the assistant message never is — reload shows the question with no answer and no resume/regenerate, and quota was still consumed. Wide window on long Deep Research / Agent runs.
**Fix:** Flush a partial `finalContent` in the catch/`finally` and on `beforeunload`/AbortError when non-empty. Ideally create the assistant row on first delta and PATCH it as it streams (add an append-or-update endpoint).

**C5. 401 mid-chat on the stream endpoint bypasses the global session watchdog.**
`page.tsx:555-564`; `FeatureChat.tsx:330-337`; `SpaceChat.tsx:243-250`; `lib/api.ts:42-43, 88`. A session expiring during a chat leaves the user in a broken half-logged-in state: a cryptic "HTTP 401" toast, never redirected to `/login`, every retry silently fails — the exact failure the `on401` watchdog (api.ts:11-18) exists to prevent, on the endpoint users hit most.
**Fix:** Export the `on401`/`notifyUnauthorized()` handler from `lib/api.ts` and invoke it in all three stream sends when `r.status === 401` (and when the reader rejects mid-stream with 401), then throw a friendly message.

**C6. Home page persists `Error: …` SSE errors into history as a fake assistant turn.**
`page.tsx:655-668, 655-682`. Transient backend failures get written to the DB as the assistant's answer; on reload the user sees a permanent "Error: model request failed" bubble that's also fed back to the model as context on the next turn (`:533-539`). SpaceChat already guards this with a `synthetic` flag; home and feature do not — three surfaces, three behaviors for the identical SSE event.
**Fix:** Track a `synthetic`/`isError` flag, render the error inline for the live turn, and skip `chatsApi.append` when it's an error: `if (activeChatId && finalContent !== "" && !synthetic)`. Standardize across all three files. (Same applies to the agent-mode error path — see C7.)

**C7. Agent-mode replies/errors on the home page are never correctly persisted; abort leaves a permanent "Working" turn.**
`page.tsx:522-525, 703-778, 716, 726, 691-692`; `agent.go:140-201`. Two confirmed bugs: (a) agent failures are saved as legitimate assistant replies, so reload shows "⚠ Couldn't complete the task" as a real answer that becomes next-turn context (SpaceChat guards with `synthetic`; home does not); (b) an abort/net-drop with no terminal event leaves the bubble stuck on "Working…" forever, and the saved trace reads as still-working on reload.
**Fix:** Track a `synthetic`/`failed` flag in `runAgent` set in the error branch (~767) and skip `chatsApi.append` at ~774 when set. Wrap `runAgent` in try/finally that rewrites "Working" → "Stopped" if no terminal event arrived. Persist only genuine `answer` content. Persist structured steps in `meta` (see C8) rather than a flattened markdown blob.

**C8. Message order on reload is non-deterministic — the assistant turn can render before its user turn.**
backend `chats.go:332-343` (`ORDER BY`), `:429-431` (INSERT, `created_at DEFAULT now()`); `001_init.up.sql:61`. Ordering relies on per-transaction `now()` + random-UUID tiebreak, which is not monotonic. Under rapid/co-located inserts the transcript silently reverses or interleaves on reload. Compounded by the frontend's two independent fire-and-forget appends (user turn + assistant turn) with no atomicity (`page.tsx:516-518` and `:677-681`).
**Fix:** Add a monotonic per-chat `seq BIGINT` populated inside the append transaction (`SELECT COALESCE(MAX(seq),0)+1 … FOR UPDATE`) and `ORDER BY seq`; at minimum switch the INSERT to `clock_timestamp()`. Never order by random id. Persist the (Q, A) pair atomically (or carry a client sequence in `meta`).

**C9. RTL: fenced code blocks are not pinned LTR — they render right-aligned and bidi-reordered on Arabic pages.**
`AssistantMessage.tsx:284` (`<pre className="md-code">`); `dashboard.css:579-593, 709-724`. Inside an Arabic answer or RTL UI, code inherits RTL: the scrollbar jumps left, the first visual column becomes the right edge, Copy/Canvas buttons (`inset-inline-end`) move left, and lines with neutral characters (operators, punctuation, comments) scramble. Shell/JSON/code in Arabic chats becomes hard or impossible to read.
**Fix:** Force LTR on the block — CSS is cleanest and also covers the legacy `.md-body pre` path: `.md-code, .md-body pre { direction: ltr; text-align: left; unicode-bidi: isolate; }`.

**C10. Mobile: the soft keyboard hides the docked composer; the home chat stage is ~56px too tall.**
`layout.tsx:91`; `dashboard.css:458`. Tapping the textarea raises the keyboard over the send button, and because the home composer is outside the scroll area it cannot be scrolled into view. Separately the stage uses `height:100dvh` so the composer is pushed ~56px below the viewport / clipped on phones, compounding the problem.
**Fix:** Add `interactiveWidget: 'resizes-content'` to the viewport export and a `visualViewport` listener applying a keyboard `padding-bottom` inset to the composer. For the stage, use `flex:1` + `min-height:0` and drop `height:100dvh` (or `calc(100dvh - 56px)` at narrow widths).

### 3.2 High (clearly-felt UX gaps, missing feedback, A11y blockers)

**H1. No "searching the web / researching" state — backend `status` phase events are dropped; Deep Research shows the generic loader for tens of seconds.**
`page.tsx:581-670` (loop), `:669` ("'status'…advisory only"); backend emits `{"phase":"retrieval"}`/`{"phase":"reasoning"}` at `handler.go:242,247`. With Web search or Deep Research on, the user gets the same 3-dot loader as a fast reply — no confirmation the toggle engaged, no indication the latency is Brave retrieval (not a hung model). Worst for Deep Research (LLM query-expansion + up to 6 serial ~12s Brave searches). The hint UI already exists and is styled (`FeatureChat.tsx:39`, `.msg-loading-hint` `dashboard.css:788`) — it's just never driven by `status` for search.
**Fix:** Add an `else if (event === "status")` branch in all three send loops that sets the loading row's `hint` from `parsed.phase` (`retrieval` → `s.searchingWeb`/`s.researching`; `reasoning` → clear or `s.generating`). Change the loading message type to `{ id; role:"loading"; hint? }`. Add the i18n strings to both locales. Have the backend emit incremental progress for Deep Research (`{phase:'searching', step:i, total}`) so the UI can show "Searching sources 3/6…".

**H2. Loader is dropped at response-headers time, leaving an empty/invisible assistant bubble until the first token.**
`page.tsx:566-573`; `FeatureChat.tsx:339-342`; `SpaceChat.tsx:252-255`. The pulsing loader is removed the instant the SSE *headers* arrive, not when the first token does. During TTFT (seconds, longer after web search) the user sees a blank assistant area — looks like the response finished empty or the app froze. The single most visible "is it working?" gap.
**Fix:** Keep the loading row mounted until the first `delta`/`content` event; swap it in the same `setMessages` on the first delta. Alternatively render a blinking caret on an empty `.msg-assistant.streaming` bubble so the gap is never blank.

**H3. No streaming cursor/indicator once the loading placeholder is replaced.**
`page.tsx:566-573`; `AssistantMessage.tsx:35-79` (no streaming prop). After the placeholder is swapped for the real message there is no signal the model is still typing. If the provider stalls between tokens or emits long tool/thinking gaps, a half-finished answer is indistinguishable from a completed one.
**Fix:** Pass an `isStreaming` boolean to the streaming row (true until `done`/`content`/AbortError) and render a blinking caret after the markdown body; add a `.md-body--streaming::after` CSS rule.

**H4. No retry/regenerate affordance and the typed prompt is destroyed on any failure.**
`page.tsx:468, 683-698`; `FeatureChat.tsx:254, 415-424`; `SpaceChat.tsx:191, 339-348`. On any send failure (network drop, 502, quota, expired session) the message text is already gone from the box; to retry the user must retype from memory. Every competitor keeps a one-click Retry. High-friction and frequent on flaky mobile connections.
**Fix:** On non-abort failure restore the draft (`setValue(text)`), and/or render a Retry button on the failed assistant row that re-invokes `send()` with the original `text` (prefer the latter so the transcript stays intact).

**H5. No "jump to latest" affordance once the user scrolls up during streaming.**
`page.tsx:166-241`; `FeatureChat.tsx:482-494`; `SpaceChat.tsx:451-475`. The only way to re-engage autofollow is to manually scroll back within 120px of the bottom. A user who scrolls up to re-read a long streaming answer gets no signal new content is arriving and no one-tap return — a common dead end every major chat UI solves with a floating down-arrow pill.
**Fix:** Track `atBottom` in React state (updated in `onScroll`). When `!atBottom`, render a floating button over the transcript that calls `endRef.scrollIntoView({block:"end"})` and re-sets the stick ref true. Optionally badge it when new tokens arrived while scrolled up.

**H6. Smooth scroll fired on every streamed token causes laggy, stacked, never-settling auto-scroll (and O(n²) jank).**
`page.tsx:193-196`; `FeatureChat.tsx:193-196`; `SpaceChat.tsx:143-146`. `behavior:"smooth"` is for occasional discrete jumps; re-targeting it every few ms keeps the viewport perpetually mid-animation, lagging behind the true bottom (the "rubber-banding/floaty" feel). In `useLayoutEffect` it also forces a synchronous layout on every token, compounding the per-token markdown re-parse. The single biggest perceived-jank source; most visible in Agent Mode where step blocks grow in large increments.
**Fix:** Use `behavior:"auto"` (instant) while streaming; reserve `smooth` for the one-time scroll when a brand-new row is appended. Pair with delta coalescing (H7) so it's one scroll per frame. Set a `programmaticScrollRef` around the call so the growing `scrollHeight` can't spuriously disable autofollow mid-stream.

**H7. Every streamed token re-parses the entire in-flight answer through react-markdown (O(n²) over answer length).**
`page.tsx:629-640` + `AssistantMessage.tsx:48-68`; `FeatureChat.tsx:383-388`; `SpaceChat.tsx:295-300`. `React.memo` protects prior turns but does nothing for the message actively streaming — the one that grows large. On long code-heavy or research answers the main thread spends increasing time per token re-parsing markdown, so streaming visibly stutters as the answer grows.
**Fix:** Coalesce deltas — buffer incoming text and flush to `setMessages` at most once per animation frame (rAF) or every ~50–80ms instead of once per token; optionally wrap in `startTransition`. This also turns the per-token scroll (H6) into one scroll per frame.

**H8. Inline `[n]` citation markers are inert plain text — no click-through, hover, or scroll-to-source.**
`AssistantMessage.tsx:45-69, 82-124`; backend prompt `handler.go:872-880`. The product's core "numbered citations" value prop is half-built: the markers render but can't be clicked to open/jump to a source, give no hover preview, and on long answers the card rail is scrolled away — defeating the purpose of inline numbering.
**Fix:** Add a ReactMarkdown text/`p` post-processor (or rehype plugin) that replaces `/\[(\d+)\]/` with an anchor/button mapped to the matching `SourceCardData` by `n`: web cards → `<a href={card.url} target="_blank">`, MCP/file cards → a button that scrolls to and expands that card (give each card `id={`src-${card.n}`}`). At minimum add a hover tooltip with the source title.

**H9. Streaming answer live region re-announces the whole growing message token-by-token.**
`page.tsx:199`; `FeatureChat.tsx:826`; `SpaceChat.tsx:534`. The transcript is `role="log" aria-live="polite"` with `aria-relevant` including `text`, so the mutating assistant paragraph is re-queued and re-read dozens-to-hundreds of times — a garbled, stuttering, never-finishing announcement, and no clean "answer complete" signal. The single worst screen-reader experience in the chat. Opening an existing chat also dumps the entire restored transcript into the live region at once (`page.tsx:102-113`).
**Fix:** Don't live-announce the streaming node character-by-character. Render the in-flight message `aria-hidden` (or outside the live region) and announce only the final text once `done` lands, via a dedicated visually-hidden `aria-live="polite"` status node. At minimum use `aria-relevant="additions"` so only whole new nodes, not intra-node edits, are announced. Suppress live announcements on bulk/history load.

**H10. `role="menu"` popovers/model-pickers contain plain buttons & links, not menuitems.**
`page.tsx:888, 967`; `FeatureChat.tsx:603, 690`; SpaceChat composer popovers. The `menu` role requires owned `menuitem` children; with plain buttons, screen readers announce a menu with zero items, arrow-key navigation is broken, and `aria-pressed` toggles conflict with menu semantics.
**Fix:** Simplest and correct — drop `role="menu"` and let these be a normal group of buttons/links (they already work via Tab + Enter). Otherwise commit fully to the menu pattern (`menuitem`/`menuitemcheckbox`/`menuitemradio` + roving tabindex).

**H11. Focus is lost after sending via mouse/keyboard because the send button self-disables.**
`page.tsx:1002-1014`; `FeatureChat.tsx:784-794`; `SpaceChat.tsx:~437`. A user who activates Send while focus is on the button has focus dropped to `<body>` when the button disables — ejecting keyboard/switch users to the top of the document on every send. (Enter-in-textarea users are unaffected.)
**Fix:** Return focus to the composer textarea after a send dispatches — `taRef.current?.focus()` right after `setValue("")` and/or in `finally`.

**H12. 402 model_locked is mis-labeled as "monthly usage limit reached"; raw `HTTP <n>` codes leak.**
`page.tsx:562-563, 714`; `FeatureChat.tsx:337`; `SpaceChat.tsx:250`; `try/page.tsx:52`; backend distinguishes the two at `handler.go:59-72`. A user blocked because their plan doesn't unlock the chosen model is told they hit their usage limit (wrong fix advised). The backend ships the correct human message in `error`, which the UI discards. Non-402 errors show meaningless `HTTP <n>`.
**Fix:** Read the JSON body before throwing: `const b = await r.json().catch(()=>null); if (r.status===402) throw new Error(b?.error || s.quotaReached);` or branch on `b?.code === 'model_locked'` to a dedicated localized string. Map 429/5xx to friendly localized messages.

**H13. Empty-response and mid-stream-drop fallbacks are missing/inconsistent across surfaces.**
`page.tsx:581-682`; `FeatureChat.tsx:350-424`; `SpaceChat.tsx:266-348`. Home leaves a blank assistant bubble when the stream yields zero content (only SpaceChat has the "No response, try again" guard). A mid-stream network drop leaves a truncated answer that looks complete — and on home that partial is persisted as canonical and re-fed to the model. SSE `error` presentation also diverges (inline-only on home vs. toast+inline elsewhere; partial answer discarded on home/feature).
**Fix:** Port SpaceChat's empty-response guard to home/feature. On a non-abort `reader.read()` rejection after content streamed, append a localized "… (response interrupted, retry)" marker and skip persistence (or persist with an incomplete meta flag). Extract one shared stream-handler so all three behave identically: always `toast.error` on `error`, render a localized inline marker, preserve already-streamed partial content, localize the "Error:" prefix.

**H14. Composer textareas lack `dir="auto"` — typed direction is wrong for the non-page language.**
`page.tsx:791-808`; `FeatureChat.tsx:533-545`; `SpaceChat.tsx:357-369`; `dashboard.css:339`. Bilingual users mixing Arabic and English get wrong caret position, alignment, and punctuation placement while typing, and a mismatch with how the sent message renders (chips already use `dir="auto"`).
**Fix:** Add `dir="auto"` to each composer `<textarea>` so the field flips to match the first strong character typed.

**H15. Composer textarea has no accessible name on Feature and Space chats; mic button is always enabled on unsupported browsers.**
`FeatureChat.tsx:533-538`; `SpaceChat.tsx:357-362`; mic at `page.tsx:1001`, `useDictation.ts:41,48,128`. Two of three primary chat inputs can be announced as an unlabeled "edit text" (placeholder is not a reliable accessible name). On Firefox/unsupported browsers the mic looks operational to AT/keyboard users but only flashes a toast.
**Fix:** Add `aria-label={s.placeholder}` (Feature) and `aria-label={s.spaceChatPlaceholder}` (Space), mirroring `page.tsx:796`. When `!voice.supported`, render the mic `disabled aria-disabled="true"` with `s.voiceUnsupported` (or hide it); wire `voice.supported` into all three composers.

**H16. Media (image/video) turns are silently dropped from saved history on reload.**
`FeatureChat.tsx:432-478` (generateMedia), `:146-150` (reload mapper). After generating, the user sees the result in-thread, but on reload only the prompt remains — looks like the generation never happened, and the next text turn's history (`:315-319`) carries no record of it. The bytes are durably saved in `media_assets`; the chat just never references them.
**Fix:** After `generateMedia` succeeds, persist an assistant message referencing the durable `/api/media/{id}` URL(s) + kind in `content`/`meta` (not the expiring OSS URL). Add a `media` branch to the reload mapper at `:146` to rehydrate.

**H17. Stopping a media generation discards the result; image generation can't be stopped at all.**
`FeatureChat.tsx:235-240` (stop), `:432-478` (generateMedia). Stopping a (billable, minute-long) video gives no hint the upstream job continues and its output is thrown away. Stopping an image does nothing useful — the image still lands in the transcript once the backend responds.
**Fix:** Pass an `AbortSignal` into `mediaApi.image` and check `mediaAbortRef` before the `setMessages` that appends media (mirror the video poll guards). After `stop()`, drop the late result when `mediaAbortRef.current` is true; if the media API supports cancellation, call it for video, else surface a note that the job continues in the background.

### 3.3 Medium (polish, robustness, consistency)

**M1. Stopped partial answer is shown but never persisted, and there's no "stopped" feedback.**
`page.tsx:676-698, 312-316`; `FeatureChat.tsx:407-424`; `SpaceChat.tsx:336-348`. A user who stops, reads the partial, then reloads loses it (only the user message reloads). The stop is also silent — indistinguishable from a natural finish or a dropped connection, with no SR announcement.
**Fix:** In the `AbortError` branch, when `finalContent` is non-empty and `activeChatId` exists, persist it via `chatsApi.append` (optionally tagged truncated). Append a subtle italic "Response stopped" / "تم الإيقاف" marker (track user-initiated vs. navigation-initiated aborts so only the Stop-button path surfaces it). Add the i18n string.

**M2. Textarea stays editable and Enter-armed while sending, with no busy cue.**
`page.tsx:791-808`; `FeatureChat.tsx:533-545`; `SpaceChat.tsx:357-369`. During a long stream the composer looks interactive; pressing Enter does nothing (the `!sending` guard eats it) with no explanation.
**Fix:** Give the textarea an `aria-busy` + reduced-opacity busy affordance while sending, and either queue the message to send on stream completion or show a subtle "finishing previous response…" hint so the swallowed Enter is discoverable.

**M3. Feature and Space composer drafts are lost on navigation (no draft persistence).**
`FeatureChat.tsx:71`; `SpaceChat.tsx:46`; contrast `page.tsx:263-265` (uses the session store). A half-typed prompt survives navigation on home but is silently wiped when tabbing away from a feature/space workspace or switching between them.
**Fix:** Route the Feature/Space draft through the same session store, keyed per feature-slug / space-id so drafts don't bleed across workspaces.

**M4. "Generating" loading state is not reliably announced to screen readers.**
`page.tsx:215-217`; `FeatureChat.tsx:832`; `SpaceChat.tsx:540`. The label sits on a non-interactive, role-less `<span>`, so it's generally not spoken — a blind user often hears nothing between send and first token. (The aria-label also says "Generating" even while web search runs — fix alongside H1.)
**Fix:** Render a visually-hidden `role="status"` text node carrying the (phase-aware) label inside the loading row; keep the brand/dots `aria-hidden`.

**M5. GFM task-list checkboxes render with stray list bullets.**
`dashboard.css:564` (no `.task-list-item`/`.contains-task-list` rule); markup from `AssistantMessage.tsx:48-49`. Models frequently emit task lists for plans/checklists (Agent Mode encourages them); they currently show both a bullet *and* the checkbox, misaligned — looks broken next to Claude/ChatGPT.
**Fix:** Add `.md-body ul.contains-task-list { list-style:none; padding-inline-start:0; }`, `.md-body li.task-list-item { display:flex; align-items:flex-start; gap:8px; }`, `… input[type=checkbox]{ margin-top:4px; }`.

**M6. Inline code spans are not bidi-isolated inside RTL Arabic sentences.**
`dashboard.css:569-578` (`.md-body code`). An inline code token starting with a neutral/weak character (`` `--no-verify` ``, `` `/api/path` ``) embedded in Arabic prose can be visually reordered, detaching its leading symbol. Intermittent (pure-ASCII identifiers usually survive).
**Fix:** Add `unicode-bidi: isolate;` (and optionally `direction: ltr;`) to `.md-body code`. This also fixes the Agent-Mode step list garbling on RTL pages (`page.tsx:748,757`).

**M7. File-excerpt citation panel uses `dir="auto"` where `dir="ltr"` is needed.**
`AssistantMessage.tsx:187` vs the MCP panel at `:206` (correctly `ltr`). A structured machine excerpt (JSON/CSV/log/path) containing any Arabic flips the whole `<pre>` to RTL, scrambling its line/column layout — the same bug the MCP panel was deliberately fixed to avoid.
**Fix:** Change `dir="auto"` to `dir="ltr"` on `AssistantMessage.tsx:187`.

**M8. Agent Mode step rendering leaks raw internals and corrupts markdown.**
`page.tsx:748, 750-757`; `agent.go:201, 533, 574-580, 206-211, 633-641`. Three confirmed issues in the one place users watch an external app being called: (a) raw mangled tool ids (`r<hex>__<tool>`) shown instead of a friendly connector/tool label; (b) raw `tool error: …` upstream strings (an internal sentinel) surfaced as the observation; (c) backticks/brackets/hashes in tool I/O break the rendered step markdown. Also: a mid-execution tool call looks identical to a finished one (no per-tool spinner).
**Fix:** Backend — attach a friendly display name to the action step (reuse the `refs`/`addSource` resolution) and map known failures to friendly text, stripping the `tool error:` sentinel before streaming. Frontend — escape/inline-code the query/preview, strip a leading `tool error: ` defensively, and render an in-flight marker (⏳/spinner) on the bullet that lacks an observation yet. Seed a "Planning…" line on the `status` event so the planning phase isn't a blank bubble.

**M9. Loading animations don't respect `prefers-reduced-motion`.**
`dashboard.css:761, 773, 777-784, 353`. Users with OS "reduce motion" still get a continuously scaling brand-mark and bouncing dots for the full duration of every reply.
**Fix:** Extend the existing reduced-motion media query to `animation:none` (keep the placeholder visible but static) for `.msg-loading-mark` and `.msg-loading-dots span`.

**M10. Code blocks never show their language; Copy button scrolls out of view on wide code; Copy fallback can capture button labels.**
`AssistantMessage.tsx:261-262, 283-306` (no language label); `dashboard.css:709-716, 954-955` (actions scroll away); `AssistantMessage.tsx:266` (fallback captures `Open in CanvasCopy…`). Three small code-block polish gaps.
**Fix:** Render a muted `.md-code-lang` label when `lang` is truthy; pin `.md-code-actions` via a non-scrolling `position:relative` wrapper (or `position:sticky; inset-inline-end:8px`); scope the copy fallback to the inner `<code>` element only (`ref.current?.querySelector('code')?.innerText`).

**M11. Persistence failures are completely silent; a failed user-turn append desyncs the saved thread.**
`page.tsx:516-518, 676-682`; `FeatureChat.tsx:279-281, 407-409`; `SpaceChat.tsx:213-215, 336-338`. Both appends are non-awaited and swallow errors with `.catch(()=>{})`. If the user-turn append fails but the assistant one succeeds (or vice-versa), the reloaded transcript shows an orphaned turn with zero feedback — the "reliable history" promise degrades invisibly.
**Fix:** Surface persistence failures (a one-time toast / subtle "not saved" indicator on reject), and/or persist the user+assistant pair in a single backend call so they can't land half-written; retry once before giving up.

**M12. "Open in Canvas" is a dead no-op on the public `/try` and `/s` pages.**
`AppShell.tsx:66-77`; `AssistantMessage.tsx:286-294`; `try/page.tsx:148`; `s/[id]/page.tsx:56`. A visible, enabled button does nothing when clicked — on the highest-traffic acquisition surfaces (public trial + shared-answer viral loop). No `CanvasDrawer` is mounted there.
**Fix:** Mount `<CanvasDrawer />` in the public branch of `Shell`, or expose a `canvasEnabled` flag from `useCanvas()` (false for the no-op stub) and hide the button when no drawer host is present.

**M13. Canvas overlay lacks `aria-modal`, focus trap, and body-scroll-lock; snapshot goes stale if opened mid-stream.**
`CanvasDrawer.tsx:41-44`; `dashboard.css:973-980`; `AssistantMessage.tsx:263, 286-294`. The "split-pane beside chat" is actually a covering modal that SR users can tab behind and that scroll-chains on touch. Opening canvas during streaming yields a partial render that never re-syncs.
**Fix:** Add `aria-modal="true"`, lock body scroll on open (mirror `Modal.tsx`), and add a basic focus trap. Gate the "Open in Canvas" button until the message is done streaming (pass an `isStreaming` flag down), or make the artifact live so the iframe re-renders on new tokens.

### 3.4 Low (minor inconsistencies, edge cases)

- **L1. Empty-URL web card renders `<a href="">` that reloads the page.** `AssistantMessage.tsx:100-112, 143-168`. Not reachable from a fresh stream (backend filters `URL!=''`) but possible from stored JSON. Fix: `href={card.url || undefined}` so an empty URL produces a non-link element.
- **L2. MCP/file source cards give no hint they're expandable.** `AssistantMessage.tsx:170-208`; `dashboard.css:861-868`. Fix: add a rotating chevron (rotated when `aria-expanded`) + a hover style so the card reads as interactive.
- **L3. Expand/collapse state keyed by array index can open the wrong source card after citations change.** `AssistantMessage.tsx:42, 74-75, 172-205`. Fix: key the open state by stable `card.n`, not array index; reset to null when the citations reference changes.
- **L4. User vs assistant turns are not distinguishable to screen readers.** `page.tsx:223-236` (and Feature/Space transcripts). Fix: add a visually-hidden "You:" / "Pervagans:" `sr-only` label as the first child of each bubble.
- **L5. `/try` requires Cmd/Ctrl+Enter to send while the app sends on plain Enter, and `/try` lacks the `isComposing` IME guard.** `try/page.tsx:123` vs `page.tsx:803`/`FeatureChat.tsx:540`/`SpaceChat.tsx:364`. Fix: align `/try` to plain-Enter-sends + Shift+Enter newline and add the `!isComposing` guard.
- **L6. Delta frames that fail `JSON.parse` are silently dropped (token lost), and the canonical `content` event is ignored once any delta arrived.** `page.tsx:617-618, 629-640, 641-654` vs backend `handler.go:283-286`. Low probability (backend JSON-marshals deltas). Fix: `console.warn` on parse failure; on the `content` event, if `parsed.content` differs from `finalContent`, reconcile to canonical once at end-of-stream.
- **L7. Switching model mid-stream desyncs the pill from the model actually generating.** `page.tsx:299-305, 527-544, 979-983`. Fix: disable the model picker rows while `sending` (simplest, matches Claude/ChatGPT), or pin the pill to the in-flight turn's model.
- **L8. Canvas drawer header title is always the generic "Canvas".** `AssistantMessage.tsx:290`; `CanvasDrawer.tsx:63`; `canvas-context.tsx:13`. Fix: derive a title at open time (first `<title>`/`<h1>`, or "Untitled "+kind) and use it for the header and download filename.
- **L9. Dictation base-text capture races with manual edits / IME composition.** `useDictation.ts:67-75, 118-126`. Edge case (requires simultaneous type+dictate). Fix: re-read the current textarea value when committing speech instead of overwriting from a stale `baseRef`.

### Notes on de-duplication / dropped items

- The smooth-scroll-per-token finding was reported by four separate agents (streaming, auto-scroll, Agent-Mode, performance); merged into **H6** with the O(n²) markdown cost as **H7** and the spurious-autofollow-disable race folded into H6's fix.
- The "status events ignored / no search feedback" finding appeared in three reports (loading-state, web-search UX, agent loop); merged into **H1** and **M8**.
- The "error persisted as fake assistant turn" / "synthetic flag missing on home" finding appeared in the error, persistence, and agent reports; merged into **C6**/**C7**.
- The MCP `isError`-treated-as-success defect is a backend correctness/security bug (agent.go/remote.go) outside this section's UX scope; flagged here only insofar as it surfaces a false ✅ to the user (covered behaviorally by M8) and is owned by the backend section.
- Dropped as out-of-scope-for-this-section or backend-owned: quota refund-on-failure, Brave rate-limiting/concurrency, SSRF guard, history-truncation leading-assistant 400, UTF-8 rune-splitting, fence-marker injection, SSE heartbeat/keep-alive — all real but belong to the backend/security sections, not UX/waiting/errors/mobile/RTL/a11y/persistence.
- Partial-markdown re-parse flicker (`AssistantMessage.tsx:48-68`) was judged acceptable/inherent and not listed as an actionable defect; the actionable part (coalescing re-parse) is covered by H7.

---

## 4. Fix plan — what to fix first

The findings below are de-duplicated (e.g. the "smooth-scroll on every token" defect appeared in 4 separate reports; the "MCP `isError` treated as success" in 3; the "stale-closure double-send" in 2 — each is listed once). Speculative or low-confidence items (consecutive same-role guard, dictation race, /try Cmd+Enter inconsistency, cache-key aliasing, dead `extra_snippets` field) are dropped or folded into the backlog note at the end.

Ranking heuristic: **(severity × hit-frequency) ÷ effort**. "Hit-frequency" weights how many normal users hit it per session, not worst-case.

| # | Problem (one line) | Location | Fix | Effort | FE/BE |
|---|---|---|---|---|---|
| 1 | Smooth `scrollIntoView` fires on every streamed token → perpetual rubber-banding jank (the single most-felt streaming flaw) | `page.tsx:193-196`, `FeatureChat.tsx:193-196`, `SpaceChat.tsx:143-146` | Use `behavior:"auto"` while streaming; keep `smooth` only for the initial open. | **S** | FE |
| 2 | Every delta re-parses the entire growing answer through react-markdown — O(n²), visible slowdown on long answers | `page.tsx:629-640` + `AssistantMessage.tsx:48-68`; mirrored in Feature/Space | Coalesce deltas: buffer text, flush to `setMessages` once per `requestAnimationFrame` (~50-80ms) instead of per token. Pairs with #1 (one scroll per frame). | **M** | FE |
| 3 | Loader dropped at response-**headers** time → empty/invisible bubble during the whole TTFT window; looks frozen | `page.tsx:566-573`, `FeatureChat.tsx:339-342`, `SpaceChat.tsx:252-255` | Keep the loading row mounted until the **first** delta/content event, then swap in the same `setMessages`. | **S** | FE |
| 4 | Double-send race: `sending` guard is a stale closure with no synchronous lock → duplicate turns + double quota charge | `page.tsx:450-469,803-806`; `FeatureChat.tsx:242-255`; `SpaceChat.tsx:179-192` | Add `useRef(false)` lock set at top of `send()`, cleared in `finally`, checked in send() + keydown. | **S** | FE |
| 5 | Stop is a no-op during the pre-stream window (controller created after several awaits) — button lies, full answer + charge still land | `page.tsx:312-316,469-561`; same in Feature/Space | Create the `AbortController` before the first await; after each pre-stream await check `signal.aborted` and bail. | **M** | FE |
| 6 | MCP tool-level errors (`isError:true`) reported as success — green ✅, fake source card, model synthesizes from error payload | `remote.go:705-723`, `agent.go:633-637,203-214` | Decode `result.isError`; if true return an error so execTool's `tool error:` path fires (no source card, model sees failure). | **S** | BE |
| 7 | Mid-stream provider error events silently swallowed → truncated answer returned & persisted as a successful completion | `client.go:541-565,640-664,765-793,828-855`; `dashscope.go:146-173` | Decode the `error` event type in each parser; return accumulated text + non-nil error so an SSE `error` frame is emitted. | **M** | BE |
| 8 | 401 mid-chat on the stream endpoint bypasses the session watchdog — no redirect, user types into a dead session | `page.tsx:555-564`; `FeatureChat.tsx:330-337`; `SpaceChat.tsx:243-250`; `api.ts:42-43` | Export `notifyUnauthorized()` from `api.ts`; call it on `r.status===401` in all three stream sends (and on mid-stream reader 401). | **S** | FE |
| 9 | Failure destroys the typed prompt with no retry/regenerate — user must retype from memory (frequent on flaky mobile) | `page.tsx:468,683-698`; `FeatureChat.tsx:254,415-424`; `SpaceChat.tsx:191,339-348` | On non-abort failure restore `setValue(text)` (and/or render a Retry button on the failed row). Clear composer only after fetch OK. | **S** | FE |
| 10 | Home persists `Error: …` / agent-failure strings into history as real assistant turns — pollutes reload + next-turn context | `page.tsx:655-668,522-525,703-778` | Track a `synthetic`/`isError` flag; skip `chatsApi.append` when set (mirror SpaceChat). | **S** | FE |
| 11 | History truncation can leave a leading assistant turn → hard Anthropic/Vertex 400 on long chats (default Opus) | `handler.go:552-555` | After truncation, drop leading non-user messages so the slice starts with `user`. | **S** | BE |
| 12 | Inline `[n]` citation markers are inert plain text — no click/hover/scroll-to-source (core "numbered citations" promise half-built) | `AssistantMessage.tsx:45-69,82-124`; ids needed on cards | Post-process rendered text for `/\[(\d+)\]/`, map `n`→card: web→`<a href>`, MCP/file→button that scrolls+expands the card. | **M** | FE |
| 13 | No "searching the web" feedback — backend `status` phase events explicitly dropped; Deep Research shows generic dots for tens of seconds | `page.tsx:669` (+581-670); `FeatureChat.tsx:39,833`; `handler.go:242,247` | Add `event==="status"` branch driving the existing `hint` field/`.msg-loading-hint`; localize `searchingWeb`/`researching`. Infra already exists in FeatureChat. | **M** | FE |
| 14 | Credits charged on accept with **no refund** when the model fails (chat=1, deep_research=3, agent=5) — own #1 trust-killer | `handler.go:73,274-282`; `billing.go:95-110`; `agent.go:114,305` | Move `Record` to after a successful stream, or add `Refund(userID, op)` called in upstream-error branches (not on client disconnect). | **M** | BE |
| 15 | No SSE heartbeat during long silent windows → ingress/LB drops Deep Research & Agent runs >60s mid-stream | `handler.go:242-260`; `agent.go:140-141,172-219` | Ticker goroutine writing `": ping\n\n"` + Flush every ~15s (writes funneled through one mutex/channel). | **M** | BE |
| 16 | Code blocks render RTL on Arabic pages — scrollbar/buttons flip, lines bidi-scramble (unreadable code in AR chats) | `AssistantMessage.tsx:284`; `dashboard.css:579-593,709-724` | CSS: `.md-code, .md-body pre { direction:ltr; text-align:left; unicode-bidi:isolate; }`. | **S** | FE |
| 17 | Streaming live region re-announces the whole growing message token-by-token — unusable SR flood | `page.tsx:199`; `FeatureChat.tsx:826`; `SpaceChat.tsx:534` | Drop `text` from aria-relevant (`aria-relevant="additions"`); announce final text once on `done` via a dedicated sr-only live node. | **S** | FE |
| 18 | Raw machine tool names (`r<hex>__tool`) + raw `tool error:` strings leaked into the agent step UI | `page.tsx:748,750-757`; `agent.go:201,533,633-641` | Backend: attach friendly connector+tool display name and scrub the `tool error:` sentinel. FE: strip prefix/`r<hex>__` before display. | **S** | both |
| 19 | Refresh/crash mid-stream permanently loses the in-progress assistant answer (wide window on Deep Research/Agent) | `page.tsx:673-682`; `FeatureChat.tsx:407-409`; `SpaceChat.tsx:336-338` | Persist `finalContent` in the AbortError/`beforeunload` branch when non-empty; ideally create the assistant row on first delta and PATCH it. | **M** | FE (BE for PATCH) |
| 20 | 402 `model_locked` mislabeled as "monthly usage limit reached" — wrong fix advice; backend already ships the right message | `page.tsx:563,714`; `FeatureChat.tsx:337`; `SpaceChat.tsx:250`; `handler.go:59-72` | Read JSON body on `!r.ok`; surface `body.error` / branch on `code==='model_locked'`. | **S** | FE |

### The 3 highest-leverage fixes to do immediately

1. **Switch streaming auto-scroll to `behavior:"auto"` and coalesce deltas to one flush per animation frame** (#1 + #2). One small change in three files plus a delta buffer kills the single biggest perceived-jank source *and* the O(n²) markdown re-parse simultaneously — every user feels this on every streamed answer. Highest impact-to-effort ratio in the entire audit.

2. **Keep the loading indicator alive until the first token, and add the synchronous double-send lock** (#3 + #4). Together these fix the two "is it even working?" moments that bracket every send — the dead empty-bubble gap before the first token, and the duplicate-turn/double-charge on a fast second Enter. Both are S-effort, frontend-only, and touch the same `send()` code path.

3. **Stop charging credits for failed generations + stop reporting failures as success** (#14 + #6 + #7). Refund-on-failure is the team's own stated #1 trust differentiator, and it's undermined by two correctness bugs that make failures *look* like successes (MCP `isError` → fake ✅/source card; swallowed mid-stream provider errors → truncated answer billed and persisted as complete). Fixing the trio means users stop paying for — and stop being silently handed — broken results, especially on the premium 3-5 credit Deep Research/Agent ops.
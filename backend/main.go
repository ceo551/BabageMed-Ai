package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/pervagans/backend/internal/admin"
	"github.com/pervagans/backend/internal/agent"
	"github.com/pervagans/backend/internal/api"
	"github.com/pervagans/backend/internal/audit"
	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/billing"
	"github.com/pervagans/backend/internal/cache"
	"github.com/pervagans/backend/internal/email"
	"github.com/pervagans/backend/internal/chats"
	"github.com/pervagans/backend/internal/connectors"
	"github.com/pervagans/backend/internal/db"
	"github.com/pervagans/backend/internal/llm"
	"github.com/pervagans/backend/internal/mcp"
	"github.com/pervagans/backend/internal/media"
	"github.com/pervagans/backend/internal/metrics"
	"github.com/pervagans/backend/internal/payments"
	"github.com/pervagans/backend/internal/features"
	"github.com/pervagans/backend/internal/mfa"
	"github.com/pervagans/backend/internal/ratelimit"
	"github.com/pervagans/backend/internal/share"
	"github.com/pervagans/backend/internal/spaces"
	"github.com/pervagans/backend/internal/tracing"
	"github.com/pervagans/backend/internal/updates"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/riandyrn/otelchi"
)

func main() {
	_ = godotenv.Load()

	// Tracing — picks up OTEL_EXPORTER_OTLP_ENDPOINT etc. or stays a no-op.
	shutdownTracing, err := tracing.Init(context.Background(), "pervagans-backend", "0.1.0")
	if err != nil {
		log.Printf("tracing init: %v", err)
	}

	// Manifest path resolution: explicit MCP_MANIFEST_PATH wins so ops
	// can point at any location (mounted ConfigMap, sidecar volume, etc.).
	// When it's unset we walk a fallback chain that covers the three
	// common runtime layouts: container image (/app/...), `go run` from
	// the backend dir (../scripts/...), and "the binary lives next to
	// the manifest" (mcps.manifest.json). We log each miss so a wrong
	// mount path doesn't silently fall through to a stale manifest.
	manifestCandidates := []string{}
	if explicit := os.Getenv("MCP_MANIFEST_PATH"); explicit != "" {
		manifestCandidates = append(manifestCandidates, explicit)
	}
	manifestCandidates = append(manifestCandidates,
		"/app/mcps.manifest.json",
		"scripts/mcps.manifest.json",
		"../scripts/mcps.manifest.json",
		"mcps.manifest.json",
	)
	var registry *mcp.Registry
	var manifestErr error
	for _, p := range manifestCandidates {
		registry, manifestErr = mcp.NewRegistry(p)
		if manifestErr == nil {
			log.Printf("loaded MCP manifest from %s", p)
			break
		}
		log.Printf("manifest candidate %s: %v", p, manifestErr)
	}
	if manifestErr != nil {
		log.Fatalf("manifest load failed: tried %v", manifestCandidates)
	}
	log.Printf("loaded %d MCP servers from manifest", len(registry.Servers()))

	// Database — optional. Backend runs without it; auth + persistence are disabled.
	var dbConn *db.DB
	var authSvc *auth.Service
	var payStore *payments.Store
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		// Connect with a 15 s budget — pgx's pool needs a tight ceiling
		// to surface "DB unreachable" loudly instead of letting the
		// process appear to be starting indefinitely.
		connectCtx, connectCancel := context.WithTimeout(context.Background(), 15*time.Second)
		dbConn, err = db.Open(connectCtx, dsn)
		connectCancel()
		if err != nil {
			log.Fatalf("db open: %v", err)
		}
		// Migrations get their OWN ctx with a much larger budget — a
		// cold-start running 14 migrations against a freshly created
		// DB easily exceeds 15 s (the previous shared 15 s ctx
		// occasionally aborted mid-migration on a slow node, leaving
		// partial schema).
		migrateCtx, migrateCancel := context.WithTimeout(context.Background(), 5*time.Minute)
		if err := dbConn.Migrate(migrateCtx); err != nil {
			migrateCancel()
			log.Fatalf("db migrate: %v", err)
		}
		migrateCancel()
		log.Printf("db connected, migrations up")
		authSvc = auth.New(dbConn)
		payStore = payments.NewStore(dbConn)
		// Bootstrap: promote the configured email to admin on every startup.
		// Safe & idempotent — only updates if the user already exists.
		if email := os.Getenv("BOOTSTRAP_ADMIN_EMAIL"); email != "" {
			ctx2, cancel2 := context.WithTimeout(context.Background(), 5*time.Second)
			tag, err := dbConn.Pool.Exec(ctx2, `UPDATE users SET is_admin = TRUE WHERE lower(email) = lower($1)`, email)
			cancel2()
			if err != nil {
				log.Printf("admin bootstrap: %v", err)
			} else if tag.RowsAffected() > 0 {
				log.Printf("admin bootstrap: promoted %s", email)
			} else {
				log.Printf("admin bootstrap: %s not signed up yet — will promote on next startup", email)
			}
		}
	} else {
		log.Printf("DATABASE_URL not set — auth + persistence disabled")
	}

	llmClient := llm.NewClient(llm.Config{
		AnthropicKey: os.Getenv("ANTHROPIC_API_KEY"),
		GoogleKey:    os.Getenv("GOOGLE_API_KEY"),
		// Vertex AI takes precedence over AI Studio when GOOGLE_CLOUD_PROJECT
		// is set. GOOGLE_APPLICATION_CREDENTIALS (mounted external-account
		// JSON pointing at the projected WIF token) drives ADC.
		VertexProject:  os.Getenv("GOOGLE_CLOUD_PROJECT"),
		VertexLocation: os.Getenv("GOOGLE_CLOUD_LOCATION"),
		// Anthropic-on-Vertex runs in a different region set than Gemini —
		// us-east5 is the canonical one. Empty → llm client defaults to that.
		VertexAnthropicLocation: os.Getenv("VERTEX_ANTHROPIC_LOCATION"),
		OpenAIKey:               os.Getenv("OPENAI_API_KEY"),
		// Alibaba Cloud Model Studio (DashScope) — Qwen/GLM/DeepSeek text +
		// Qwen-Image/Wan image + Happy-Horse video. Base URL optional
		// (defaults to the Singapore international endpoint).
		DashScopeKey:     os.Getenv("DASHSCOPE_API_KEY"),
		DashScopeBaseURL: os.Getenv("DASHSCOPE_BASE_URL"),
	})

	// Redis cache wrapper — gathers MCP search results so identical queries
	// inside a 5-min window skip the upstream call. Returns a no-op cache
	// when REDIS_URL is unset, so this is safe to construct unconditionally.
	cacheClient := cache.New()
	// The connectors service doubles as the per-user credential provider for
	// the chat + agent tool-call paths. Built here (when the DB is up) so it
	// can be injected into the handler and the agent; its HTTP routes are
	// registered later in the authenticated block. nil when there's no DB —
	// both consumers are nil-safe and fall back to the pod's shared env token.
	var connSvc *connectors.Service
	// Usage metering: per-plan monthly credit caps on expensive ops (wrapper
	// economics). nil when there's no DB — Check/Record are nil-safe + fail-open.
	var billingSvc *billing.Service
	if dbConn != nil {
		connSvc = connectors.New(dbConn, authSvc, registry)
		billingSvc = billing.New(dbConn, authSvc)
	}
	apiH := api.NewHandler(registry, llmClient, cacheClient, connSvc, billingSvc)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	if tracing.Enabled() {
		r.Use(otelchi.Middleware("pervagans-backend", otelchi.WithChiRoutes(r)))
	}
	r.Use(tracing.TraceIDHeader)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	// 5 min covers the worst-case streamed LLM response (Gemini "long-form
	// clinical reasoning" answers can run ~60-90s end-to-end). The chat
	// streaming handler honours ctx cancellation early once the client
	// disconnects, so this large ceiling only kicks in for legitimately
	// long-running answers, not as a "hide leaks" knob.
	r.Use(middleware.Timeout(5 * time.Minute))
	r.Use(metrics.Middleware())
	// CORS — wildcard origin + AllowCredentials=true is invalid per spec
	// (browsers reject the response), so we read an explicit allow-list
	// from CORS_ALLOWED_ORIGINS (comma-separated). PUBLIC_BASE_URL is
	// always allowed because that's where the canonical web client lives.
	// The Tauri desktop shell on Windows sends Origin
	// "http://tauri.localhost", so it's allow-listed by default — that
	// way signed-in users on the desktop client work out of the box
	// without operators having to remember to add it.
	allowedOrigins := buildAllowedOrigins(
		os.Getenv("CORS_ALLOWED_ORIGINS"),
		os.Getenv("PUBLIC_BASE_URL"),
	)
	// Loud failure beats silent misconfig — if neither CORS_ALLOWED_ORIGINS
	// nor PUBLIC_BASE_URL was set AND the dev fallbacks are disabled
	// (publicBase non-empty), the list will be tauri+publicBase only.
	// We only fatal when the list is *truly* empty, which buildAllowedOrigins
	// guarantees can't happen — but keep this guard for posterity if the
	// helper ever changes.
	if len(allowedOrigins) == 0 {
		log.Fatalf("CORS allow-list resolved to empty — set CORS_ALLOWED_ORIGINS or PUBLIC_BASE_URL")
	}
	log.Printf("CORS allow-list: %v", allowedOrigins)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Content-Type", "X-Trace-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	// Origin/Referer CSRF defence for state-changing methods. CORS only
	// stops *browsers* from reading the response — it does not stop the
	// request from arriving, and SameSite=Lax cookies still ride along on
	// top-level POST/PUT/PATCH/DELETE from a malicious origin (esp. the
	// multipart upload endpoint). Reject any non-safe method whose Origin
	// (preferred) or Referer (fallback for Safari quirks) does not match
	// the same allow-list CORS uses. Safe methods (GET/HEAD/OPTIONS) bypass.
	r.Use(originCSRFGuard(allowedOrigins))
	if authSvc != nil {
		r.Use(authSvc.Optional)
	}

	// /health stays the rich dashboard endpoint (fans out to MCPs);
	// /livez + /readyz are the cheap probes Kubernetes should target so
	// one sick MCP can't restart the whole backend pod (see
	// templates/backend.yaml liveness/readiness probes).
	r.Get("/health", apiH.Health)
	r.Get("/livez", apiH.Live)
	r.Get("/readyz", apiH.Ready)
	r.Method("GET", "/metrics", metrics.Handler())

	// Rate-limit buckets — separate budgets so a chat spree can't lock
	// out a login retry and vice versa. Burst is generous enough for
	// normal humans (10 chat sends in a minute, 5 logins / signups in
	// 5 minutes) while still throttling credential stuffing + runaway
	// SSE fan-out from a single client.
	chatLimiter := ratelimit.New(10, 6*time.Second) // ~10 burst, +1 every 6 s → 10/min sustained
	authLimiter := ratelimit.New(5, time.Minute)    // ~5 burst, +1/min → defeats password spraying
	// Dedicated MFA bucket so a successful password-stuffing attempt
	// doesn't share the 5-burst budget with the login bucket — that
	// gave the attacker a free 5-code burst at the 6-digit TOTP space
	// before throttling kicked in.
	mfaLimiter := ratelimit.New(3, 30*time.Second) // 3 burst, +1 every 30 s → 2/min sustained
	// Tools bucket — /api/mcp/call fans out to paid upstream APIs
	// (FDA, PubMed, OpenAI image gen, …). Without a cap, a single
	// authenticated user can drain the org's API budget in a loop.
	// 20-burst absorbs a "load the connector dropdown" UI moment;
	// +1 every 3s = 20/min sustained, well above human use but tight
	// enough to flag a runaway script.
	toolsLimiter := ratelimit.New(20, 3*time.Second)
	// Uploads bucket — file ingest does PDF parsing + text chunking
	// per call. A single client looping 100 uploads/sec can starve
	// CPU. 10-burst tolerates a multi-file drop; +1/5s sustains 12/min.
	uploadLimiter := ratelimit.New(10, 5*time.Second)
	// Agent bucket — ONE /api/agent/stream request fans out to several
	// max-tier LLM rounds + many paid MCP calls, so it must be far tighter than
	// the chat bucket it used to share. 2 burst, +1 every 30 s ≈ 2/min sustained.
	agentLimiter := ratelimit.New(2, 30*time.Second)

	// MCP browse — anonymous-readable. The /call endpoint, however, runs
	// real upstream queries (paid APIs, scrape jobs) so we gate it behind
	// auth when the DB is configured AND throttle it via toolsLimiter so
	// a single user can't drain the upstream budget. When auth is
	// disabled (DEV mode without DATABASE_URL) the endpoint stays open
	// but still rate-limited.
	r.Get("/api/mcp/servers", apiH.ListServers)
	r.Get("/api/mcp/servers/{id}", apiH.GetServer)
	r.Get("/api/mcp/servers/{id}/tools", apiH.ListTools)
	if authSvc != nil {
		r.Group(func(pr chi.Router) {
			pr.Use(authSvc.Required)
			pr.Use(toolsLimiter.Middleware)
			pr.Post("/api/mcp/call/{id}/{tool}", apiH.CallTool)
		})
	} else {
		r.With(toolsLimiter.Middleware).Post("/api/mcp/call/{id}/{tool}", apiH.CallTool)
	}

	// Chat — usable anonymously, but if auth is on we'll persist messages.
	r.With(chatLimiter.Middleware).Post("/api/chat", apiH.Chat)
	r.With(chatLimiter.Middleware).Post("/api/chat/stream", apiH.ChatStream)

	// Media generation + durable persistence (DashScope) lives in the media
	// service — it needs DB + auth (results are stored as owned assets and
	// served back from /api/media/{id}), so it is registered inside the
	// authSvc block below alongside spaces/features/connectors.

	// Auth + persistence (DB-backed)
	if authSvc != nil {
		// MFA service: nil-tolerant. New() returns a no-op-but-valid
		// service when MFA_ENCRYPTION_KEY isn't set — endpoints then
		// 503 with "mfa not configured" rather than silently storing
		// plaintext secrets, and Login() skips the second-factor gate
		// entirely (treats every user as MFA-disabled).
		mfaSvc, mfaErr := mfa.New(dbConn, "Pervagans")
		if mfaErr != nil {
			log.Fatalf("mfa init: %v", mfaErr)
		}
		emailSender := email.NewFromEnv()
		auditSvc := audit.New(dbConn)

		authHandler := auth.NewHandler(authSvc)
		authHandler.SetMFAGate(mfaSvc)
		authHandler.RegisterWithLimiter(r, authLimiter.Middleware)

		// Password reset + email verification — both rate-limited (the
		// /forgot endpoint is an obvious enumeration + SMTP-spam target).
		r.Group(func(pr chi.Router) {
			pr.Use(authLimiter.Middleware)
			auth.NewResetHandler(authSvc, emailSender, auditSvc).Register(pr)
		})
		// MFA enrollment / disable endpoints — all behind auth.Required
		// (handler enforces). Uses the dedicated mfaLimiter (3 burst,
		// 2/min sustained) so a leaked password + login throttle bypass
		// doesn't grant 5 free TOTP guesses through the login budget.
		r.Group(func(pr chi.Router) {
			pr.Use(mfaLimiter.Middleware)
			mfa.NewHandler(mfaSvc, authSvc, auditSvc).Register(pr)
		})
		admin.NewHandler(dbConn, authSvc).Register(r)
		media.New(dbConn, authSvc, llmClient, billingSvc).Register(r, toolsLimiter.Middleware)
		agent.New(llmClient, registry, authSvc, connSvc, billingSvc, dbConn).Register(r, agentLimiter.Middleware)
		spaces.New(dbConn, authSvc).Register(r, uploadLimiter.Middleware)
		features.New(dbConn, authSvc).Register(r, uploadLimiter.Middleware)
		connSvc.Register(r)
		billingSvc.Register(r)
		// Public answer snapshots for the zero-login trial (P4): POST /api/share
		// (anon-writable, IP-throttled) + GET /api/share/{id} (public).
		share.New(dbConn).Register(r, chatLimiter.Middleware)
		chats.New(dbConn, authSvc).Register(r)
	}

	// Desktop auto-updater. Anonymous-readable. Reads manifest source from
	// env (DESKTOP_UPDATES_MANIFEST{,_URL,_PATH}); when unconfigured the
	// handler still mounts but answers 204 on every poll.
	updates.New(updates.ConfigFromEnv()).Register(r)

	// Payments
	payH := payments.NewHandler()
	if payStore != nil {
		payH.WithStore(payStore)
	}
	if authSvc != nil {
		payH.WithAuth(authSvc)
	}
	payH.Register(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		// ReadTimeout 2× the chi Timeout middleware so slow uploaders
		// (e.g. mobile networks finishing a multi-MB Space upload) aren't
		// cut off mid-body. IdleTimeout matches typical reverse-proxy
		// keep-alive caps so dead connections don't camp on goroutines.
		ReadTimeout: 10 * time.Minute,
		// WriteTimeout: 0 because /api/chat/stream legitimately runs
		// past 10 min in "deep" mode (Opus extended thinking). The
		// previous 10 m ceiling SIGKILL'd long answers mid-token. The
		// REAL per-request ceiling is the chi Timeout middleware
		// (5 min) at the handler level — chat-stream wires its own
		// longer per-request ctx where needed. Slowloris is bounded
		// by ReadTimeout + ReadHeaderTimeout above; an attacker can't
		// pin connections with WriteTimeout: 0 because the response
		// stream is server-driven (we write or close).
		WriteTimeout: 0,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("backend listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Printf("shutdown signal received, draining…")
	// Drain budget: 25s leaves ~5s of slack before K8s sends SIGKILL
	// at the default 30s terminationGracePeriodSeconds. Chat-stream
	// SSE handlers honour ctx cancellation, so most active streams
	// finish their current token + close cleanly. Bumped from 10s
	// because a 10s ceiling truncated mid-answer chat streams on
	// every rollout — users saw the spinner restart instead of the
	// answer completing.
	// Separate ctx per shutdown stage so a slow srv.Shutdown doesn't
	// eat the budget for closing the DB pool + flushing tracing
	// spans. The previous shared 25 s ctx caused tracing.Shutdown to
	// run on an already-deadlined ctx and drop the final span batch
	// on every rollout.
	httpCtx, httpCancel := context.WithTimeout(context.Background(), 25*time.Second)
	_ = srv.Shutdown(httpCtx)
	httpCancel()
	if dbConn != nil {
		dbConn.Close()
	}
	if shutdownTracing != nil {
		traceCtx, traceCancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = shutdownTracing(traceCtx)
		traceCancel()
	}
}

// buildAllowedOrigins assembles the CORS allow-list from env. Empty
// originCSRFGuard wraps state-changing requests with a same-origin
// check. CORS allow-lists the origin for *reading*; this middleware
// rejects writes whose Origin (or Referer fallback) is not in the
// same allow-list. Belt-and-braces alongside SameSite cookies.
func originCSRFGuard(allowed []string) func(http.Handler) http.Handler {
	allowedSet := map[string]bool{}
	for _, o := range allowed {
		allowedSet[strings.TrimRight(o, "/")] = true
	}
	originOf := func(rawURL string) string {
		if rawURL == "" {
			return ""
		}
		u, err := url.Parse(rawURL)
		if err != nil || u.Host == "" {
			return ""
		}
		return strings.TrimRight(u.Scheme+"://"+u.Host, "/")
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				origin = originOf(r.Header.Get("Referer"))
			} else {
				origin = strings.TrimRight(origin, "/")
			}
			// Same-origin in-app navigation (server-to-server, server-side
			// rendered POST) can lack both headers — only enforce when at
			// least one is set; if neither is set we fall through to the
			// auth middleware which still requires a valid session.
			if origin != "" && !allowedSet[origin] {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// PUBLIC_BASE_URL is OK during local dev — we fall back to a sensible
// set of localhost origins so `npm run dev` works out of the box.
func buildAllowedOrigins(csv, publicBase string) []string {
	seen := map[string]bool{}
	out := []string{}
	add := func(o string) {
		o = strings.TrimSpace(strings.TrimRight(o, "/"))
		if o == "" || seen[o] {
			return
		}
		seen[o] = true
		out = append(out, o)
	}
	for _, o := range strings.Split(csv, ",") {
		add(o)
	}
	add(publicBase)
	// Tauri desktop shell on Windows uses the http://tauri.localhost
	// custom scheme; allow-list it by default.
	add("http://tauri.localhost")
	// Local dev — Next.js dev server + the desktop dev WebView.
	if publicBase == "" {
		add("http://localhost:3000")
		add("http://127.0.0.1:3000")
	}
	// Caller (main) guards against an empty list with log.Fatalf, so
	// we no longer return a sentinel here — the previous
	// "http://invalid.local" placeholder masked misconfiguration.
	return out
}

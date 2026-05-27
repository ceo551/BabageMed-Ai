package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/babagemed/backend/internal/admin"
	"github.com/babagemed/backend/internal/api"
	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/cache"
	"github.com/babagemed/backend/internal/chats"
	"github.com/babagemed/backend/internal/connectors"
	"github.com/babagemed/backend/internal/db"
	"github.com/babagemed/backend/internal/llm"
	"github.com/babagemed/backend/internal/mcp"
	"github.com/babagemed/backend/internal/metrics"
	"github.com/babagemed/backend/internal/payments"
	"github.com/babagemed/backend/internal/features"
	"github.com/babagemed/backend/internal/spaces"
	"github.com/babagemed/backend/internal/tracing"
	"github.com/babagemed/backend/internal/updates"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/riandyrn/otelchi"
)

func main() {
	_ = godotenv.Load()

	// Tracing — picks up OTEL_EXPORTER_OTLP_ENDPOINT etc. or stays a no-op.
	shutdownTracing, err := tracing.Init(context.Background(), "babagemed-backend", "0.1.0")
	if err != nil {
		log.Printf("tracing init: %v", err)
	}

	registry, err := mcp.NewRegistry("scripts/mcps.manifest.json")
	if err != nil {
		for _, p := range []string{"/app/mcps.manifest.json", "../scripts/mcps.manifest.json", "mcps.manifest.json"} {
			registry, err = mcp.NewRegistry(p)
			if err == nil {
				break
			}
		}
	}
	if err != nil {
		log.Fatalf("manifest load failed: %v", err)
	}
	log.Printf("loaded %d MCP servers from manifest", len(registry.Servers()))

	// Database — optional. Backend runs without it; auth + persistence are disabled.
	var dbConn *db.DB
	var authSvc *auth.Service
	var payStore *payments.Store
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		dbConn, err = db.Open(ctx, dsn)
		if err != nil {
			log.Fatalf("db open: %v", err)
		}
		if err := dbConn.Migrate(ctx); err != nil {
			log.Fatalf("db migrate: %v", err)
		}
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
	})

	// Redis cache wrapper — gathers MCP search results so identical queries
	// inside a 5-min window skip the upstream call. Returns a no-op cache
	// when REDIS_URL is unset, so this is safe to construct unconditionally.
	cacheClient := cache.New()
	apiH := api.NewHandler(registry, llmClient, cacheClient)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	if tracing.Enabled() {
		r.Use(otelchi.Middleware("babagemed-backend", otelchi.WithChiRoutes(r)))
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
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Content-Type", "X-Trace-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	if authSvc != nil {
		r.Use(authSvc.Optional)
	}

	r.Get("/health", apiH.Health)
	r.Method("GET", "/metrics", metrics.Handler())

	// MCP browse — anonymous-readable. The /call endpoint, however, runs
	// real upstream queries (paid APIs, scrape jobs) so we gate it behind
	// auth when the DB is configured. When auth is disabled (DEV mode
	// without DATABASE_URL) the endpoint stays open so local development
	// is unaffected.
	r.Get("/api/mcp/servers", apiH.ListServers)
	r.Get("/api/mcp/servers/{id}", apiH.GetServer)
	r.Get("/api/mcp/servers/{id}/tools", apiH.ListTools)
	if authSvc != nil {
		r.Group(func(pr chi.Router) {
			pr.Use(authSvc.Required)
			pr.Post("/api/mcp/call/{id}/{tool}", apiH.CallTool)
		})
	} else {
		r.Post("/api/mcp/call/{id}/{tool}", apiH.CallTool)
	}

	// Chat — usable anonymously, but if auth is on we'll persist messages.
	r.Post("/api/chat", apiH.Chat)
	r.Post("/api/chat/stream", apiH.ChatStream)

	// Auth + persistence (DB-backed)
	if authSvc != nil {
		auth.NewHandler(authSvc).Register(r)
		admin.NewHandler(dbConn, authSvc).Register(r)
		spaces.New(dbConn, authSvc).Register(r)
		features.New(dbConn, authSvc).Register(r)
		connectors.New(dbConn, authSvc, registry).Register(r)
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
		ReadTimeout:  10 * time.Minute,
		WriteTimeout: 10 * time.Minute,
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	if dbConn != nil {
		dbConn.Close()
	}
	if shutdownTracing != nil {
		_ = shutdownTracing(ctx)
	}
}

// buildAllowedOrigins assembles the CORS allow-list from env. Empty
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
	if len(out) == 0 {
		// Last-resort: be safe and only allow same-origin
		// (no Origin header). Returning [] would make chi/cors panic on
		// startup, so use a sentinel that matches nothing useful.
		out = append(out, "http://invalid.local")
	}
	return out
}

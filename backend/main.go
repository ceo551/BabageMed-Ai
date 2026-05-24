package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/babagemed/backend/internal/admin"
	"github.com/babagemed/backend/internal/api"
	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/db"
	"github.com/babagemed/backend/internal/llm"
	"github.com/babagemed/backend/internal/mcp"
	"github.com/babagemed/backend/internal/metrics"
	"github.com/babagemed/backend/internal/payments"
	"github.com/babagemed/backend/internal/spaces"
	"github.com/babagemed/backend/internal/tracing"
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
		OpenAIKey:    os.Getenv("OPENAI_API_KEY"),
	})

	apiH := api.NewHandler(registry, llmClient)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	if tracing.Enabled() {
		r.Use(otelchi.Middleware("babagemed-backend", otelchi.WithChiRoutes(r)))
	}
	r.Use(tracing.TraceIDHeader)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(metrics.Middleware())
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	if authSvc != nil {
		r.Use(authSvc.Optional)
	}

	r.Get("/health", apiH.Health)
	r.Method("GET", "/metrics", metrics.Handler())

	// MCP browse + call — anonymous-readable
	r.Get("/api/mcp/servers", apiH.ListServers)
	r.Get("/api/mcp/servers/{id}", apiH.GetServer)
	r.Get("/api/mcp/servers/{id}/tools", apiH.ListTools)
	r.Post("/api/mcp/call/{id}/{tool}", apiH.CallTool)

	// Chat — usable anonymously, but if auth is on we'll persist messages.
	r.Post("/api/chat", apiH.Chat)
	r.Post("/api/chat/stream", apiH.ChatStream)

	// Auth + persistence (DB-backed)
	if authSvc != nil {
		auth.NewHandler(authSvc).Register(r)
		admin.NewHandler(dbConn, authSvc).Register(r)
		spaces.New(dbConn, authSvc).Register(r)
	}

	// Payments
	payH := payments.NewHandler()
	if payStore != nil {
		payH.WithStore(payStore)
	}
	payH.Register(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{Addr: ":" + port, Handler: r, ReadHeaderTimeout: 10 * time.Second}

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

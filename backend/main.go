package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/babagemed/backend/internal/api"
	"github.com/babagemed/backend/internal/llm"
	"github.com/babagemed/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	registry, err := mcp.NewRegistry("scripts/mcps.manifest.json")
	if err != nil {
		// fall back to looking in /app or parent
		alt := []string{"/app/mcps.manifest.json", "../scripts/mcps.manifest.json", "mcps.manifest.json"}
		for _, p := range alt {
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

	llmClient := llm.NewClient(llm.Config{
		AnthropicKey: os.Getenv("ANTHROPIC_API_KEY"),
		GoogleKey:    os.Getenv("GOOGLE_API_KEY"),
		OpenAIKey:    os.Getenv("OPENAI_API_KEY"),
	})

	h := api.NewHandler(registry, llmClient)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", h.Health)
	r.Get("/api/mcp/servers", h.ListServers)
	r.Get("/api/mcp/servers/{id}", h.GetServer)
	r.Get("/api/mcp/servers/{id}/tools", h.ListTools)
	r.Post("/api/mcp/call/{id}/{tool}", h.CallTool)

	r.Post("/api/chat", h.Chat)
	r.Post("/api/chat/stream", h.ChatStream)

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
}

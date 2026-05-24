// Package connectors — per-user wiring of MCP servers, modelled after
// Claude's connector UX. A row in user_connectors means the user has
// explicitly opted in; the composer popover and chat retrieval only ever
// consult MCPs the user has connected.
//
// We deliberately keep auth simple here: scrape-kind connectors install with
// one POST (no credentials needed). api-kind connectors store an optional
// config blob (API key / OAuth token) and the frontend renders a
// "Open site" link so the user can finish setup on the provider when needed.
// The provider-specific OAuth dances live in a future iteration.
package connectors

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/babagemed/backend/internal/auth"
	"github.com/babagemed/backend/internal/db"
	"github.com/babagemed/backend/internal/mcp"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type Connector struct {
	MCPID       string         `json:"mcpId"`
	Name        string         `json:"name"`
	Kind        string         `json:"kind"`
	Category    string         `json:"category"`
	Base        string         `json:"base"`
	IconURL     string         `json:"iconUrl,omitempty"`
	SiteURL     string         `json:"siteUrl,omitempty"`
	Config      map[string]any `json:"config"`
	ConnectedAt string         `json:"connectedAt"`
}

type Service struct {
	db   *db.DB
	auth *auth.Service
	reg  *mcp.Registry
}

func New(d *db.DB, a *auth.Service, r *mcp.Registry) *Service {
	return &Service{db: d, auth: a, reg: r}
}

// ─── Persistence ───────────────────────────────────────────────────────────

func (s *Service) List(ctx context.Context, userID string) ([]Connector, error) {
	rows, err := s.db.Pool.Query(ctx, `
        SELECT mcp_id, kind, config, connected_at
        FROM user_connectors
        WHERE user_id = $1
        ORDER BY connected_at DESC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Connector{}
	for rows.Next() {
		var c Connector
		var cfgRaw []byte
		var connectedAt interface{}
		if err := rows.Scan(&c.MCPID, &c.Kind, &cfgRaw, &connectedAt); err != nil {
			return nil, err
		}
		if len(cfgRaw) > 0 {
			_ = json.Unmarshal(cfgRaw, &c.Config)
		}
		if c.Config == nil {
			c.Config = map[string]any{}
		}
		// scan timestamps as strings via fmt — keeps the package free of time imports.
		switch v := connectedAt.(type) {
		case []byte:
			c.ConnectedAt = string(v)
		default:
			c.ConnectedAt = ""
		}
		// Enrich with current MCP metadata (name, base, icon).
		if srv, ok := s.reg.Get(c.MCPID); ok {
			c.Name = srv.Name
			c.Category = srv.Category
			c.Base = srv.Base
			c.IconURL = srv.IconURL
			c.SiteURL = srv.SiteURL
			// Kind snapshot in the row could go stale — prefer the registry's.
			c.Kind = srv.Kind
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Service) Connect(ctx context.Context, userID, mcpID string, config map[string]any) (*Connector, error) {
	srv, ok := s.reg.Get(mcpID)
	if !ok {
		return nil, errors.New("unknown mcp")
	}
	if config == nil {
		config = map[string]any{}
	}
	cfgJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	_, err = s.db.Pool.Exec(ctx, `
        INSERT INTO user_connectors (user_id, mcp_id, kind, config)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, mcp_id) DO UPDATE
        SET config = EXCLUDED.config, connected_at = now()
    `, userID, mcpID, srv.Kind, cfgJSON)
	if err != nil {
		return nil, err
	}
	return &Connector{
		MCPID:    srv.ID,
		Name:     srv.Name,
		Kind:     srv.Kind,
		Category: srv.Category,
		Base:     srv.Base,
		IconURL:  srv.IconURL,
		SiteURL:  srv.SiteURL,
		Config:   config,
	}, nil
}

func (s *Service) Disconnect(ctx context.Context, userID, mcpID string) error {
	tag, err := s.db.Pool.Exec(ctx, `
        DELETE FROM user_connectors WHERE user_id = $1 AND mcp_id = $2
    `, userID, mcpID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("not connected")
	}
	return nil
}

func (s *Service) Get(ctx context.Context, userID, mcpID string) (*Connector, error) {
	var c Connector
	var cfgRaw []byte
	err := s.db.Pool.QueryRow(ctx, `
        SELECT mcp_id, kind, config
        FROM user_connectors WHERE user_id = $1 AND mcp_id = $2
    `, userID, mcpID).Scan(&c.MCPID, &c.Kind, &cfgRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(cfgRaw) > 0 {
		_ = json.Unmarshal(cfgRaw, &c.Config)
	}
	if c.Config == nil {
		c.Config = map[string]any{}
	}
	if srv, ok := s.reg.Get(c.MCPID); ok {
		c.Name = srv.Name
		c.Category = srv.Category
		c.Base = srv.Base
		c.IconURL = srv.IconURL
		c.SiteURL = srv.SiteURL
		c.Kind = srv.Kind
	}
	return &c, nil
}

// ─── HTTP layer ────────────────────────────────────────────────────────────

func (s *Service) Register(r chi.Router) {
	r.Route("/api/connectors", func(r chi.Router) {
		r.Use(s.auth.Required)
		r.Get("/", s.handleList)
		r.Post("/{mcpID}", s.handleConnect)
		r.Get("/{mcpID}", s.handleGet)
		r.Delete("/{mcpID}", s.handleDisconnect)
	})
}

func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	out, err := s.List(r.Context(), u.ID)
	writeJSON(w, out, err)
}

func (s *Service) handleConnect(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	var body struct {
		Config map[string]any `json:"config"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	out, err := s.Connect(r.Context(), u.ID, chi.URLParam(r, "mcpID"), body.Config)
	writeJSON(w, out, err)
}

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	out, err := s.Get(r.Context(), u.ID, chi.URLParam(r, "mcpID"))
	if err == nil && out == nil {
		http.Error(w, "not connected", http.StatusNotFound)
		return
	}
	writeJSON(w, out, err)
}

func (s *Service) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if err := s.Disconnect(r.Context(), u.ID, chi.URLParam(r, "mcpID")); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, v any, err error) {
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

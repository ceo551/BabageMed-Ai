package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/babagemed/backend/internal/metrics"
)

type Server struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Category string `json:"category"`
	Port     int    `json:"port"`
	Base     string `json:"base"`
}

type manifest struct {
	Servers []Server `json:"servers"`
}

type Registry struct {
	mu      sync.RWMutex
	byID    map[string]Server
	all     []Server
	client  *http.Client
	hostFor func(s Server) string
}

func NewRegistry(path string) (*Registry, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m manifest
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	r := &Registry{
		byID:   map[string]Server{},
		all:    m.Servers,
		client: &http.Client{Timeout: 60 * time.Second},
		hostFor: func(s Server) string {
			h := os.Getenv("MCP_HOST_OVERRIDE")
			if h != "" {
				return fmt.Sprintf("http://%s:%d", h, s.Port)
			}
			return fmt.Sprintf("http://mcp-%s:%d", s.ID, s.Port)
		},
	}
	for _, s := range m.Servers {
		r.byID[s.ID] = s
	}
	return r, nil
}

func (r *Registry) Servers() []Server {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Server, len(r.all))
	copy(out, r.all)
	return out
}

func (r *Registry) Get(id string) (Server, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.byID[id]
	return s, ok
}

func (r *Registry) ListTools(ctx context.Context, id string) (any, error) {
	s, ok := r.Get(id)
	if !ok {
		return nil, errors.New("unknown server")
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, r.hostFor(s)+"/tools", nil)
	res, err := r.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("tools list failed: %s: %s", res.Status, string(body))
	}
	var out any
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Registry) Call(ctx context.Context, id, tool string, args any) (any, error) {
	s, ok := r.Get(id)
	if !ok {
		metrics.MCPProxyCalls.WithLabelValues(id, tool, "unknown").Inc()
		return nil, errors.New("unknown server")
	}
	timer := prometheusTimer(id, tool)
	body, _ := json.Marshal(args)
	url := fmt.Sprintf("%s/call/%s", r.hostFor(s), tool)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	res, err := r.client.Do(req)
	if err != nil {
		timer()
		metrics.MCPProxyCalls.WithLabelValues(id, tool, "transport_error").Inc()
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		b, _ := io.ReadAll(res.Body)
		timer()
		metrics.MCPProxyCalls.WithLabelValues(id, tool, fmt.Sprintf("http_%d", res.StatusCode)).Inc()
		return nil, fmt.Errorf("call %s/%s failed: %s: %s", id, tool, res.Status, string(b))
	}
	var out any
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		timer()
		metrics.MCPProxyCalls.WithLabelValues(id, tool, "decode_error").Inc()
		return nil, err
	}
	timer()
	metrics.MCPProxyCalls.WithLabelValues(id, tool, "ok").Inc()
	return out, nil
}

func prometheusTimer(id, tool string) func() {
	start := time.Now()
	return func() {
		metrics.MCPProxyDuration.WithLabelValues(id, tool).Observe(time.Since(start).Seconds())
	}
}

// Health pings the /health endpoint of every MCP and reports status.
func (r *Registry) Health(ctx context.Context) map[string]string {
	out := map[string]string{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, s := range r.Servers() {
		wg.Add(1)
		go func(s Server) {
			defer wg.Done()
			req, _ := http.NewRequestWithContext(ctx, http.MethodGet, r.hostFor(s)+"/health", nil)
			res, err := r.client.Do(req)
			status := "down"
			if err == nil {
				if res.StatusCode == 200 {
					status = "up"
				} else {
					status = fmt.Sprintf("err-%d", res.StatusCode)
				}
				res.Body.Close()
			}
			mu.Lock()
			out[s.ID] = status
			mu.Unlock()
		}(s)
	}
	wg.Wait()
	return out
}

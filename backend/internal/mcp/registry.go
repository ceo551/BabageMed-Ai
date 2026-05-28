package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/babagemed/backend/internal/metrics"
	"github.com/babagemed/backend/internal/tracing"
)

type Server struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Category string `json:"category"`
	// Feature is the broader user-facing bucket the connector belongs to
	// (one of the FEATURES_EN slugs in apps/web/app/i18n.ts: healthcare,
	// education, writing, business, …). The frontend mcps page uses this
	// to group all 539 connectors into Perplexity-style feature sections;
	// missing it makes every card fall into a single "Other" bucket.
	// The field has always been present in mcps.manifest.json — it just
	// wasn't being unmarshalled here, so /api/mcps/list silently dropped it.
	Feature  string `json:"feature,omitempty"`
	Port     int    `json:"port"`
	Base     string `json:"base"`
	// IconURL points to the official-site favicon. Computed once at registry
	// load time from Base via Google's S2 favicon endpoint — no network call.
	IconURL string `json:"iconUrl,omitempty"`
	// SiteURL is the human-facing landing page derived from Base (scheme +
	// hostname only). The frontend uses this for the "Connect / Open site"
	// flow on api-kind MCPs.
	SiteURL string `json:"siteUrl,omitempty"`
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

	// Health() cache — 5 s TTL stops a load balancer hammering the
	// anonymous /health endpoint from fanning out 540 outbound probes
	// per request.
	healthMu      sync.RWMutex
	healthCached  map[string]string
	healthExpires time.Time
}

// dnsLabelRE matches the subset of MCP ids we'll accept as DNS labels.
// The ID is interpolated into Service hostnames (mcp-<id>.<ns>.svc) so
// a "evil host" or "evil$(cat /etc/passwd)" entry in the manifest used
// to silently produce a URL http.NewRequest would accept-and-mangle.
// Locked to a-z, 0-9, and '-' (no leading/trailing dash) per RFC 1123.
var dnsLabelRE = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)

func NewRegistry(path string) (*Registry, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m manifest
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	// Validate MCP ids up-front so a malformed manifest fails at startup
	// rather than producing surprising request hostnames at runtime.
	for _, s := range m.Servers {
		if !dnsLabelRE.MatchString(s.ID) || len(s.ID) > 63 {
			return nil, fmt.Errorf("manifest: invalid MCP id %q (must be RFC 1123 DNS label, ≤63 chars)", s.ID)
		}
	}
	// Enrich each server with iconUrl + siteUrl up-front so consumers don't
	// have to recompute on every list call.
	for i := range m.Servers {
		m.Servers[i].SiteURL, m.Servers[i].IconURL = siteAndIcon(m.Servers[i].Base)
	}
	r := &Registry{
		byID:   map[string]Server{},
		all:    m.Servers,
		// otelhttp wraps the transport so the trace context propagates to MCPs.
		client: tracing.HTTPClient(&http.Client{Timeout: 60 * time.Second}),
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

// siteAndIcon derives the official site URL and a favicon URL from an MCP's
// `base` field. Returns ("", "") if base isn't a parseable absolute URL.
//
// We prefer icon.horse over Google's S2 favicon endpoint: S2 always returns a
// 16-32px favicon that gets upscaled to a blurry mess in our 28-48px slots,
// whereas icon.horse scrapes the site for the highest-resolution logo it can
// find (often a 128px+ apple-touch-icon or the full SVG mark). Browser cache
// + CDN cache make the cost negligible.
func siteAndIcon(base string) (string, string) {
	if base == "" {
		return "", ""
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return "", ""
	}
	scheme := u.Scheme
	if scheme == "" {
		scheme = "https"
	}
	host := u.Host
	site := fmt.Sprintf("%s://%s", scheme, host)
	// Strip ports — favicon service wants bare domains.
	host = strings.SplitN(host, ":", 2)[0]
	// Drop a leading "www." for the favicon lookup: icon.horse tends to return
	// the apex-domain logo whether or not the site itself redirects.
	favHost := strings.TrimPrefix(host, "www.")
	icon := fmt.Sprintf("https://icon.horse/icon/%s", favHost)
	return site, icon
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
		// Bound the read so a misbehaving MCP returning a multi-GB
		// 4xx body can't OOM the backend. 4 KiB is plenty for any
		// real error envelope.
		_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4<<10))
		return nil, fmt.Errorf("tools list failed: %s", res.Status)
	}
	// Same body cap for the success path — protects against an MCP
	// returning a 50 GB tools list. maxMcpResponseBytes (4 MiB) matches
	// the Call() path's existing limit.
	var out any
	if err := json.NewDecoder(io.LimitReader(res.Body, maxMcpResponseBytes)).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

// Max bytes we will read from an MCP server's response body. A misbehaving
// (or compromised) MCP could otherwise return a multi-GB stream and OOM
// the backend. 4 MiB easily covers any reasonable search/fetch payload.
const maxMcpResponseBytes = 4 << 20

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
	// Cap the response body to keep one bad MCP from spilling unbounded
	// memory. LimitReader (not MaxBytesReader) is used because this isn't
	// an http.ResponseWriter context.
	limited := io.LimitReader(res.Body, maxMcpResponseBytes+1)
	if res.StatusCode >= 400 {
		b, _ := io.ReadAll(limited)
		timer()
		metrics.MCPProxyCalls.WithLabelValues(id, tool, fmt.Sprintf("http_%d", res.StatusCode)).Inc()
		return nil, fmt.Errorf("call %s/%s failed: %s: %s", id, tool, res.Status, string(b))
	}
	var out any
	if err := json.NewDecoder(limited).Decode(&out); err != nil {
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
//
// CACHED for 5 s because /health is anonymously reachable on the backend
// — a load balancer hammering it would otherwise spawn 540 goroutines
// + 540 outbound HTTP requests per call, which is a trivial DoS vector.
//
// Concurrency is capped via a worker pool (not a per-MCP goroutine with
// a semaphore) so the spawn cost itself is bounded. With 32 workers
// pulling from a 540-item queue the total wall time stays similar to
// the previous "fan out and wait" approach.
func (r *Registry) Health(ctx context.Context) map[string]string {
	// Fast path: serve cached results inside the TTL window.
	r.healthMu.RLock()
	if r.healthCached != nil && time.Now().Before(r.healthExpires) {
		copyOut := make(map[string]string, len(r.healthCached))
		for k, v := range r.healthCached {
			copyOut[k] = v
		}
		r.healthMu.RUnlock()
		return copyOut
	}
	r.healthMu.RUnlock()

	servers := r.Servers()
	out := make(map[string]string, len(servers))
	var mu sync.Mutex
	const workers = 32
	queue := make(chan Server, len(servers))
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for s := range queue {
				if ctx.Err() != nil {
					mu.Lock()
					out[s.ID] = "down"
					mu.Unlock()
					continue
				}
				// 3s ceiling per call keeps a single stuck MCP from
				// holding a worker goroutine for the full 60s of the
				// shared client timeout.
				hctx, cancel := context.WithTimeout(ctx, 3*time.Second)
				req, _ := http.NewRequestWithContext(hctx, http.MethodGet, r.hostFor(s)+"/health", nil)
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
				cancel()
				mu.Lock()
				out[s.ID] = status
				mu.Unlock()
			}
		}()
	}
	for _, s := range servers {
		queue <- s
	}
	close(queue)
	wg.Wait()

	// Don't cache a result derived from a cancelled context. The worker
	// loop marks every remaining MCP "down" on ctx cancel; without this
	// guard a single client disconnect on /health poisons the 5 s
	// cache so every subsequent dashboard pull serves all-down. When
	// ctx is cancelled we still return the partial map (caller may
	// want to render what came through) but skip the cache write.
	if ctx.Err() == nil {
		r.healthMu.Lock()
		r.healthCached = out
		r.healthExpires = time.Now().Add(5 * time.Second)
		r.healthMu.Unlock()
	}
	return out
}

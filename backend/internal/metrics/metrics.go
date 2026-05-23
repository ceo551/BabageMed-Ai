// Package metrics owns the Prometheus collectors for the backend, exposes
// them at /metrics, and provides chi middleware that records every HTTP
// request.
package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	HTTPRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "backend_http_requests_total",
			Help: "HTTP requests served by the backend, by route, method, and status.",
		},
		[]string{"route", "method", "status"},
	)

	HTTPDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "backend_http_request_duration_seconds",
			Help:    "HTTP request duration, by route, method, and status.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
		},
		[]string{"route", "method", "status"},
	)

	MCPProxyCalls = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "backend_mcp_proxy_calls_total",
			Help: "Tool invocations forwarded by the backend to MCP servers, by mcp + tool + outcome.",
		},
		[]string{"mcp", "tool", "outcome"},
	)

	MCPProxyDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "backend_mcp_proxy_duration_seconds",
			Help:    "End-to-end backend→MCP→backend round-trip duration, by mcp + tool.",
			Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60},
		},
		[]string{"mcp", "tool"},
	)

	LLMCalls = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "backend_llm_calls_total",
			Help: "LLM completion calls, by provider, model, and outcome.",
		},
		[]string{"provider", "model", "outcome"},
	)

	LLMDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "backend_llm_duration_seconds",
			Help:    "LLM completion call duration, by provider and model.",
			Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120},
		},
		[]string{"provider", "model"},
	)

	AuthSignups = prometheus.NewCounter(prometheus.CounterOpts{Name: "backend_auth_signups_total", Help: "Successful signups."})
	AuthLogins  = prometheus.NewCounterVec(prometheus.CounterOpts{Name: "backend_auth_logins_total", Help: "Login attempts."}, []string{"outcome"})
	Payments    = prometheus.NewCounterVec(prometheus.CounterOpts{Name: "backend_payments_total", Help: "Payments observed by provider + status."}, []string{"provider", "status"})

	registry = prometheus.NewRegistry()
)

func init() {
	registry.MustRegister(
		HTTPRequests, HTTPDuration,
		MCPProxyCalls, MCPProxyDuration,
		LLMCalls, LLMDuration,
		AuthSignups, AuthLogins, Payments,
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
}

// Handler returns the /metrics http.Handler.
func Handler() http.Handler {
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{Registry: registry})
}

// Middleware returns chi middleware that records every HTTP request.
func Middleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rw := &statusRecorder{ResponseWriter: w, status: 200}
			next.ServeHTTP(rw, r)
			route := chi.RouteContext(r.Context()).RoutePattern()
			if route == "" {
				route = "unmatched"
			}
			status := strconv.Itoa(rw.status)
			HTTPRequests.WithLabelValues(route, r.Method, status).Inc()
			HTTPDuration.WithLabelValues(route, r.Method, status).Observe(time.Since(start).Seconds())
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (r *statusRecorder) WriteHeader(code int) {
	if !r.wroteHeader {
		r.status = code
		r.wroteHeader = true
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		r.wroteHeader = true
	}
	return r.ResponseWriter.Write(b)
}

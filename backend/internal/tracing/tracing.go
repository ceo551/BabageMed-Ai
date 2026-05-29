// Package tracing initialises the OpenTelemetry SDK for the backend and
// exposes helpers for downstream code: an instrumented http.Client used to
// proxy MCP calls (so the trace context propagates), a chi middleware that
// adds trace_id to the request context, and a pgx.Tracer for postgres.
//
// Tracing is OFF unless OTEL_EXPORTER_OTLP_ENDPOINT (or
// OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) is set, or OTEL_TRACING_ENABLED=true.
package tracing

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.27.0"
	"go.opentelemetry.io/otel/trace"
)

var tp *sdktrace.TracerProvider

// Enabled reports whether tracing was successfully initialised.
func Enabled() bool { return tp != nil }

// Init sets up the global tracer provider and returns a shutdown func.
// Safe to call when tracing is disabled — returns a no-op shutdown.
func Init(ctx context.Context, serviceName, serviceVersion string) (func(context.Context) error, error) {
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") == "" &&
		os.Getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") == "" &&
		os.Getenv("OTEL_TRACING_ENABLED") != "true" {
		return func(context.Context) error { return nil }, nil
	}

	// Pick gRPC or HTTP exporter based on the OTLP protocol env.
	protocol := strings.ToLower(os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"))
	if protocol == "" {
		protocol = strings.ToLower(os.Getenv("OTEL_EXPORTER_OTLP_TRACES_PROTOCOL"))
	}
	var exporter *otlptrace.Exporter
	var err error
	if protocol == "http/protobuf" || protocol == "http" {
		exporter, err = otlptracehttp.New(ctx)
	} else {
		exporter, err = otlptracegrpc.New(ctx)
	}
	if err != nil {
		return nil, fmt.Errorf("otlp exporter: %w", err)
	}

	res, err := resource.New(ctx,
		resource.WithFromEnv(),
		resource.WithProcess(),
		resource.WithTelemetrySDK(),
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(serviceVersion),
			attribute.String("service.namespace", "babbage"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("otel resource: %w", err)
	}

	tp = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(samplingRate()))),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	log.Printf("tracing: OTLP exporter started (%s)", strings.ToUpper(protocol))
	return tp.Shutdown, nil
}

func samplingRate() float64 {
	switch s := os.Getenv("OTEL_TRACES_SAMPLER_ARG"); s {
	case "":
		return 1.0
	default:
		var f float64
		_, err := fmt.Sscanf(s, "%f", &f)
		if err != nil || f < 0 {
			return 1.0
		}
		return f
	}
}

// HTTPClient returns an http.Client that propagates the current trace context
// in outgoing requests. Use it for MCP proxy calls + LLM API calls.
func HTTPClient(inner *http.Client) *http.Client {
	if inner == nil {
		inner = http.DefaultClient
	}
	return &http.Client{
		Timeout:   inner.Timeout,
		Transport: otelhttp.NewTransport(inner.Transport),
	}
}

// Middleware returns chi middleware that:
//   1. Starts a server span for every incoming request (via otelchi).
//   2. Injects trace_id and span_id into the context's structured logger
//      so backend logs can be correlated to traces.
func TraceIDHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if span := trace.SpanFromContext(r.Context()); span.SpanContext().IsValid() {
			w.Header().Set("X-Trace-Id", span.SpanContext().TraceID().String())
		}
		next.ServeHTTP(w, r)
	})
}

// PgxQueryTracer is a tiny pgx.QueryTracer that wraps every query in a span.
type PgxQueryTracer struct{}

type pgxTraceKey struct{}

func (PgxQueryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if !Enabled() {
		return ctx
	}
	ctx, span := otel.Tracer("babbage/backend/pgx").Start(ctx, "pgx.query")
	span.SetAttributes(
		attribute.String("db.system", "postgresql"),
		attribute.String("db.statement", truncate(data.SQL, 1024)),
	)
	return context.WithValue(ctx, pgxTraceKey{}, span)
}

func (PgxQueryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	span, _ := ctx.Value(pgxTraceKey{}).(trace.Span)
	if span == nil {
		return
	}
	defer span.End()
	if data.Err != nil {
		span.RecordError(data.Err)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

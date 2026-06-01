// OpenTelemetry tracing for MCP servers.
//
// Auto-instruments http (incoming + outgoing), fetch (undici), and any other
// libraries picked up by auto-instrumentations-node. Manual spans for tool
// handlers (see server.ts) carry tool.name + outcome attributes.
//
// Tracing is OFF by default. Enable by setting either OTEL_TRACING_ENABLED=true
// or OTEL_EXPORTER_OTLP_ENDPOINT=<collector-url>. Standard OTel env vars
// (OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES, etc.) are honoured.
import { context, trace, type Span, SpanStatusCode } from "@opentelemetry/api";

let started = false;

export function startTracing(serviceName: string, serviceVersion = "0.1.0"): void {
  if (started) return;
  const enabled =
    process.env.OTEL_TRACING_ENABLED === "true" ||
    !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    !!process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (!enabled) return;

  // Dynamic import so the heavy OTel SDK is loaded only when tracing is on.
  (async () => {
    try {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
      const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
      const { Resource } = await import("@opentelemetry/resources");
      const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

      const sdk = new NodeSDK({
        resource: new Resource({
          [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || serviceName,
          [ATTR_SERVICE_VERSION]: serviceVersion,
          "service.namespace": "pervagans",
          "mcp.id": serviceName.replace(/^pervagans-mcp-/, ""),
        }),
        traceExporter: new OTLPTraceExporter(),
        instrumentations: [
          getNodeAutoInstrumentations({
            // Noisy and rarely useful — disable the fs + dns auto-instr.
            "@opentelemetry/instrumentation-fs": { enabled: false },
            "@opentelemetry/instrumentation-dns": { enabled: false },
          }),
        ],
      });
      sdk.start();
      started = true;
      // process.once so tests / hot-reload that re-invoke startTracing()
      // never stack additional listeners (Node warns at 10).
      const shutdown = () => sdk.shutdown().catch(() => {});
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
      // log to stderr so we don't pollute the stdio MCP channel
      process.stderr.write(JSON.stringify({ t: new Date().toISOString(), lvl: "info", svc: serviceName, msg: "tracing started" }) + "\n");
    } catch (e: any) {
      process.stderr.write(JSON.stringify({ t: new Date().toISOString(), lvl: "warn", svc: serviceName, msg: "tracing init failed", err: String(e?.message || e) }) + "\n");
    }
  })();
}

/** Returns { trace_id, span_id } from the current active span, or empty {}. */
export function currentSpanIds(): { trace_id?: string; span_id?: string } {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const ctx = span.spanContext();
  if (!ctx.traceId || ctx.traceId === "00000000000000000000000000000000") return {};
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

/** Run `fn` inside a new span with the given name + attributes. */
export async function withSpan<T>(name: string, attrs: Record<string, string | number | boolean | undefined>, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = trace.getTracer("pervagans/mcp-base");
  return tracer.startActiveSpan(name, async (span) => {
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined) span.setAttribute(k, v as any);
    try {
      const out = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return out;
    } catch (e: any) {
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e?.message });
      throw e;
    } finally {
      span.end();
    }
  });
}

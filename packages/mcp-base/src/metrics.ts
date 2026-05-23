// Prometheus instrumentation shared by every MCP server.
// Each McpServer owns its own Registry so multiple instances in the same
// process (mostly tests) don't collide.
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export class McpMetrics {
  readonly registry = new Registry();
  readonly toolCalls: Counter<"tool" | "outcome">;
  readonly toolDuration: Histogram<"tool" | "outcome">;
  readonly httpRequests: Counter<"path" | "method" | "status">;
  readonly httpDuration: Histogram<"path" | "method" | "status">;

  constructor(public serverId: string, public serverName: string) {
    this.registry.setDefaultLabels({ mcp_id: serverId, mcp_name: serverName });
    collectDefaultMetrics({ register: this.registry, prefix: "mcp_" });

    this.toolCalls = new Counter({
      name: "mcp_tool_calls_total",
      help: "Total tool invocations on this MCP server, by tool and outcome.",
      labelNames: ["tool", "outcome"],
      registers: [this.registry],
    });

    this.toolDuration = new Histogram({
      name: "mcp_tool_duration_seconds",
      help: "Time spent inside a tool handler, by tool and outcome.",
      labelNames: ["tool", "outcome"],
      registers: [this.registry],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
    });

    this.httpRequests = new Counter({
      name: "mcp_http_requests_total",
      help: "Total HTTP requests served by this MCP, by path, method, and status code.",
      labelNames: ["path", "method", "status"],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: "mcp_http_request_duration_seconds",
      help: "HTTP request duration in seconds, by path, method, and status code.",
      labelNames: ["path", "method", "status"],
      registers: [this.registry],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}

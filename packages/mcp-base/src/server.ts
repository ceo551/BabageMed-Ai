import { z, ZodTypeAny } from "zod";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { McpServerInfo, McpToolDef, JsonRpcRequest, JsonRpcResponse, ToolContext } from "./types.js";
import { createLogger } from "./logger.js";
import { McpMetrics } from "./metrics.js";
import { withSpan } from "./tracing.js";

function zodToJsonSchema(schema: ZodTypeAny): unknown {
  // Minimal Zod -> JSON Schema; we use Zod's `.describe` and shapes for primitive cases.
  // Avoids pulling in zod-to-json-schema dep for the base library.
  const def: any = (schema as any)._def;
  if (!def) return { type: "object" };
  switch (def.typeName) {
    case "ZodObject": {
      const shape = def.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape) as [string, ZodTypeAny][]) {
        properties[k] = zodToJsonSchema(v);
        if (!(v as any).isOptional?.()) required.push(k);
      }
      return { type: "object", properties, required };
    }
    case "ZodString":
      return { type: "string", description: def.description };
    case "ZodNumber":
      return { type: "number", description: def.description };
    case "ZodBoolean":
      return { type: "boolean", description: def.description };
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type) };
    case "ZodOptional":
      return zodToJsonSchema(def.innerType);
    case "ZodDefault":
      return zodToJsonSchema(def.innerType);
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodLiteral":
      return { const: def.value };
    case "ZodNullable":
      return { ...((zodToJsonSchema(def.innerType) as object) || {}), nullable: true };
    case "ZodUnion":
      return { anyOf: def.options.map((o: ZodTypeAny) => zodToJsonSchema(o)) };
    default:
      return {};
  }
}

export class McpServer {
  private tools = new Map<string, McpToolDef<any, any>>();
  private log: ReturnType<typeof createLogger>;
  readonly metrics: McpMetrics;

  constructor(public info: McpServerInfo) {
    this.log = createLogger(info.id);
    this.metrics = new McpMetrics(info.id, info.name);
  }

  tool<TInput, TOutput>(def: McpToolDef<TInput, TOutput>): this {
    this.tools.set(def.name, def);
    return this;
  }

  private async callTool(name: string, input: unknown): Promise<unknown> {
    const t = this.tools.get(name);
    if (!t) throw Object.assign(new Error(`unknown tool: ${name}`), { code: -32601 });
    const parsed = t.input.safeParse(input ?? {});
    if (!parsed.success) {
      throw Object.assign(new Error(`invalid input: ${parsed.error.message}`), { code: -32602 });
    }
    const ctx: ToolContext = {
      log: (lvl, msg, meta) => (this.log as any)[lvl](msg, meta),
    };
    const stop = this.metrics.toolDuration.startTimer({ tool: name });
    return withSpan(
      `mcp.tool.${name}`,
      { "mcp.id": this.info.id, "mcp.name": this.info.name, "mcp.tool": name, "mcp.kind": this.info.kind },
      async () => {
        try {
          const out = await t.handler(parsed.data as any, ctx);
          this.metrics.toolCalls.inc({ tool: name, outcome: "ok" });
          stop({ outcome: "ok" });
          return out;
        } catch (e) {
          this.metrics.toolCalls.inc({ tool: name, outcome: "error" });
          stop({ outcome: "error" });
          throw e;
        }
      },
    );
  }

  private listToolsForRpc() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.input),
    }));
  }

  private async handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const respond = (result?: unknown, error?: JsonRpcResponse["error"]): JsonRpcResponse => ({
      jsonrpc: "2.0",
      id: req.id,
      ...(error ? { error } : { result }),
    });
    try {
      switch (req.method) {
        case "initialize":
          return respond({
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: this.info.name, version: this.info.version },
          });
        case "tools/list":
          return respond({ tools: this.listToolsForRpc() });
        case "tools/call": {
          const p = (req.params as { name?: string; arguments?: unknown }) || {};
          if (!p.name) throw Object.assign(new Error("missing tool name"), { code: -32602 });
          const result = await this.callTool(p.name, p.arguments);
          return respond({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          });
        }
        case "ping":
          return respond({});
        default:
          return respond(undefined, { code: -32601, message: `method not found: ${req.method}` });
      }
    } catch (e: any) {
      return respond(undefined, { code: e.code ?? -32000, message: e.message || String(e) });
    }
  }

  /** Start an HTTP server exposing both an MCP JSON-RPC endpoint and a friendly REST tool-call endpoint. */
  startHttp(port: number) {
    const srv = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const method = req.method || "GET";
      // Bucket the path so /call/<tool> doesn't explode the label cardinality.
      const labelPath =
        url.pathname.startsWith("/call/") ? "/call/:tool" :
        url.pathname === "/metrics" || url.pathname === "/health" || url.pathname === "/info" ||
        url.pathname === "/tools" || url.pathname === "/rpc" ? url.pathname : "other";
      const stopHttp = this.metrics.httpDuration.startTimer({ path: labelPath, method });
      try {
        if (req.method === "GET" && url.pathname === "/health") {
          stopHttp({ status: "200" });
          this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
          return json(res, 200, { ok: true, id: this.info.id, name: this.info.name, kind: this.info.kind });
        }
        if (req.method === "GET" && url.pathname === "/metrics") {
          const body = await this.metrics.render();
          stopHttp({ status: "200" });
          this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
          res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
          return res.end(body);
        }
        if (req.method === "GET" && url.pathname === "/info") {
          stopHttp({ status: "200" });
          this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
          return json(res, 200, { ...this.info, tools: this.listToolsForRpc() });
        }
        if (req.method === "GET" && url.pathname === "/tools") {
          stopHttp({ status: "200" });
          this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
          return json(res, 200, { tools: this.listToolsForRpc() });
        }
        if (req.method === "POST" && url.pathname === "/rpc") {
          const body = await readBody(req);
          let rpcReq: JsonRpcRequest;
          try {
            rpcReq = JSON.parse(body || "{}");
          } catch {
            // Per JSON-RPC 2.0 spec, parse errors return -32700 with
            // id:null inside a 200 envelope. Returning HTTP 500 (the
            // previous behaviour via the outer try/catch) breaks clients
            // that expect a structured RPC envelope.
            stopHttp({ status: "200" });
            this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
            return json(res, 200, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
          }
          const out = await this.handleJsonRpc(rpcReq);
          stopHttp({ status: "200" });
          this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
          return json(res, 200, out);
        }
        // Friendly: POST /call/<toolName> with JSON body = arguments
        if (req.method === "POST" && url.pathname.startsWith("/call/")) {
          const name = decodeURIComponent(url.pathname.slice("/call/".length));
          const body = await readBody(req);
          const args = body ? JSON.parse(body) : {};
          const out = await this.callTool(name, args);
          stopHttp({ status: "200" });
          this.metrics.httpRequests.inc({ path: labelPath, method, status: "200" });
          return json(res, 200, { ok: true, result: out });
        }
        stopHttp({ status: "404" });
        this.metrics.httpRequests.inc({ path: labelPath, method, status: "404" });
        return json(res, 404, { error: "not found" });
      } catch (e: any) {
        this.log.error("http error", { msg: e.message, path: url.pathname });
        const status = e.code === -32602 ? 400 : 500;
        stopHttp({ status: String(status) });
        this.metrics.httpRequests.inc({ path: labelPath, method, status: String(status) });
        return json(res, status, { error: e.message || String(e) });
      }
    });
    srv.listen(port, () => this.log.info(`HTTP listening on :${port}`));
    return srv;
  }

  /** Start stdio MCP protocol — required for direct MCP-client integration. */
  startStdio() {
    let buffer = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", async (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const req = JSON.parse(line) as JsonRpcRequest;
          const out = await this.handleJsonRpc(req);
          process.stdout.write(JSON.stringify(out) + "\n");
        } catch (e: any) {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "parse error: " + e.message },
            }) + "\n"
          );
        }
      }
    });
    this.log.info("stdio MCP ready");
  }

  /** Run both transports unless STDIO_ONLY=1 or HTTP_ONLY=1 is set. */
  run() {
    // Lazy import so tracing doesn't load unless enabled.
    import("./tracing.js").then(({ startTracing }) => startTracing(`pervagans-mcp-${this.info.id}`, this.info.version)).catch(() => {});
    const stdio = process.env.HTTP_ONLY !== "1";
    const http = process.env.STDIO_ONLY !== "1";
    if (stdio) this.startStdio();
    if (http) this.startHttp(this.info.port);
  }
}

function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

// Cap the inbound JSON-RPC / tool-call body at 10 MB. The MCP servers only
// ever receive small JSON payloads (tool name + a handful of string args);
// anything bigger is almost certainly an attack trying to OOM the pod by
// streaming gigabytes. Without this cap, `data += c` grew unboundedly and
// a single bad client could take down one of the 416 pods.
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        const err = Object.assign(new Error("request body too large"), { code: 413 });
        // Stop accepting data and destroy the socket so the attacker can't
        // keep pushing bytes after we've already decided to fail.
        req.destroy(err);
        reject(err);
        return;
      }
      data += c;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export { z };

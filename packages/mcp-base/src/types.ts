import { z } from "zod";

// "stub" is for Phase-B connectors registered in the catalog but
// returning {status:"not-configured"} from every tool until OAuth /
// API-key wiring lands. Previously these were mis-classified as "api"
// and the manifest reclassification (changing 223 entries from api →
// stub) broke type-checking on every stub's src/index.ts.
export type McpKind = "api" | "scrape" | "hybrid" | "stub";

export interface McpServerInfo {
  id: string;
  name: string;
  kind: McpKind;
  category: string;
  base: string;
  port: number;
  version: string;
}

export interface McpToolDef<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  input: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export interface ToolContext {
  log: (level: "info" | "warn" | "error" | "debug", msg: string, meta?: unknown) => void;
  abortSignal?: AbortSignal;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

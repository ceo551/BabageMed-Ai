import { z } from "zod";

export type McpKind = "api" | "scrape" | "hybrid";

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

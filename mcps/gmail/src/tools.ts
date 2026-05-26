import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
import { googleAccessToken } from "./google.js";
// Lazy, persistent client so the response cache + rate-limit slot
// survive across tool invocations. The per-call `new ApiClient(...)`
// pattern reset nextSlot to 0 on every call, completely bypassing the
// rps:3 throttle, and the cache always missed.
let _client: ApiClient | null = null;
async function client(): Promise<ApiClient> {
  if (!_client) _client = new ApiClient({ base: "https://gmail.googleapis.com/gmail/v1", rps: 3 });
  const t = await googleAccessToken();
  (_client as unknown as { opts: { defaultHeaders: Record<string, string> } }).opts.defaultHeaders = { Authorization: `Bearer ${t}` };
  return _client;
}
export function registerTools(server: McpServer) {
  server.tool({ name: "list", description: "List Gmail messages.", input: z.object({ q: z.string().optional(), maxResults: z.number().int().min(1).max(500).optional() }), handler: async ({ q, maxResults = 20 }) => (await client()).get<any>("users/me/messages", { q, maxResults }) });
  server.tool({ name: "get", description: "Get a single message.", input: z.object({ id: z.string() }), handler: async ({ id }) => (await client()).get<any>(`users/me/messages/${id}`) });
  server.tool({ name: "search", description: "Search Gmail.", input: z.object({ q: z.string() }), handler: async ({ q }) => (await client()).get<any>("users/me/messages", { q, maxResults: 50 }) });
  server.tool({ name: "send", description: "Send a Gmail message (raw MIME or simple to/subject/body).", input: z.object({ to: z.string(), subject: z.string(), body: z.string() }), handler: async ({ to, subject, body }) => {
    const mime = `From: me\nTo: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=UTF-8\n\n${body}`;
    const raw = Buffer.from(mime).toString("base64url");
    return (await client()).post<any>("users/me/messages/send", { raw });
  }});
}

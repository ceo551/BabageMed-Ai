// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient, googleAccessToken } from "@pervagans/mcp-base";

// Build the ApiClient once so the cache + rate-limit slot survive across
// calls. Auth is attached per request (googleAuth), not baked onto the
// shared client (that would race across concurrent per-user requests).
let _client: ApiClient | null = null;
function client(): ApiClient {
  if (!_client) {
    _client = new ApiClient({ base: "https://www.googleapis.com/drive/v3", rps: 3 });
  }
  return _client;
}
// Per-call Google auth: the user's own access token (ctx.credential) if
// present, else the shared env refresh-token flow.
async function googleAuth(ctx: { credential?: string }): Promise<Record<string, string>> {
  const token = ctx.credential || (await googleAccessToken());
  return { Authorization: `Bearer ${token}` };
}

// Escape a string for use inside a Drive query single-quoted literal.
// Drive's documented escape: backslash → \\, single-quote → \'.
// Doing this in the wrong order ('\' first then quoting) would re-escape
// the just-inserted backslashes; we replace backslash FIRST so each pass
// sees the unmodified input.
function driveQuote(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function registerTools(server: McpServer) {
  server.tool({
    name: "list",
    description: "List files.",
    input: z.object({ q: z.string().optional(), pageSize: z.number().int().min(1).max(1000).optional() }),
    handler: async ({ q, pageSize = 20 }, ctx) =>
      client().get<any>("files", { q, pageSize, fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)" }, { headers: await googleAuth(ctx) }),
  });
  server.tool({
    name: "get",
    description: "Get a file metadata.",
    input: z.object({ id: z.string() }),
    handler: async ({ id }, ctx) =>
      client().get<any>(`files/${encodeURIComponent(id)}`, {
        fields: "id,name,mimeType,modifiedTime,size,webViewLink,parents",
      }, { headers: await googleAuth(ctx) }),
  });
  server.tool({
    name: "search",
    description: "Search drive by name.",
    // Reject control chars / newlines in the search term so an attacker
    // can't smuggle additional query clauses through.
    input: z.object({ name: z.string().min(1).max(256).regex(/^[^\x00-\x1f]+$/) }),
    handler: async ({ name }, ctx) =>
      client().get<any>("files", {
        q: `name contains '${driveQuote(name)}'`,
        pageSize: 50,
        fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      }, { headers: await googleAuth(ctx) }),
  });
  server.tool({
    name: "upload",
    description: "Create a text file in Drive.",
    input: z.object({ name: z.string(), content: z.string(), mimeType: z.string().optional() }),
    handler: async ({ name, content, mimeType = "text/plain" }, ctx) => {
      const t = ctx.credential || (await googleAccessToken());
      const boundary = "bmai" + Date.now();
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      return await r.json();
    },
  });
}

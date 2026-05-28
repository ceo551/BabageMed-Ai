// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient, googleAccessToken } from "@babagemed/mcp-base";

// Build the ApiClient once and refresh its Authorization header per call.
// Each tool previously did `new ApiClient(...)` which discarded the cache
// + rate-limit slot state on every invocation, defeating the rps:3 cap.
let _client: ApiClient | null = null;
async function client(): Promise<ApiClient> {
  if (!_client) {
    _client = new ApiClient({ base: "https://www.googleapis.com/drive/v3", rps: 3 });
  }
  const t = await googleAccessToken();
  // ApiClient.defaultHeaders is what we set the token through. Reassign
  // the whole header object so a rotated bearer is picked up.
  (_client as unknown as { opts: { defaultHeaders: Record<string, string> } }).opts.defaultHeaders = {
    Authorization: `Bearer ${t}`,
  };
  return _client;
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
    handler: async ({ q, pageSize = 20 }) =>
      (await client()).get<any>("files", { q, pageSize, fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)" }),
  });
  server.tool({
    name: "get",
    description: "Get a file metadata.",
    input: z.object({ id: z.string() }),
    handler: async ({ id }) =>
      (await client()).get<any>(`files/${encodeURIComponent(id)}`, {
        fields: "id,name,mimeType,modifiedTime,size,webViewLink,parents",
      }),
  });
  server.tool({
    name: "search",
    description: "Search drive by name.",
    // Reject control chars / newlines in the search term so an attacker
    // can't smuggle additional query clauses through.
    input: z.object({ name: z.string().min(1).max(256).regex(/^[^\x00-\x1f]+$/) }),
    handler: async ({ name }) =>
      (await client()).get<any>("files", {
        q: `name contains '${driveQuote(name)}'`,
        pageSize: 50,
        fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      }),
  });
  server.tool({
    name: "upload",
    description: "Create a text file in Drive.",
    input: z.object({ name: z.string(), content: z.string(), mimeType: z.string().optional() }),
    handler: async ({ name, content, mimeType = "text/plain" }) => {
      const t = await googleAccessToken();
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

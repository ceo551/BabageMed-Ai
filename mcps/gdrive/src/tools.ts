import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
import { googleAccessToken } from "./google.js";
async function client() { const t = await googleAccessToken(); return new ApiClient({ base: "https://www.googleapis.com/drive/v3", rps: 3, defaultHeaders: { Authorization: `Bearer ${t}` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "list", description: "List files.", input: z.object({ q: z.string().optional(), pageSize: z.number().int().min(1).max(1000).optional() }), handler: async ({ q, pageSize = 20 }) => (await client()).get<any>("files", { q, pageSize, fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)" }) });
  server.tool({ name: "get", description: "Get a file metadata.", input: z.object({ id: z.string() }), handler: async ({ id }) => (await client()).get<any>(`files/${id}`, { fields: "id,name,mimeType,modifiedTime,size,webViewLink,parents" }) });
  server.tool({ name: "search", description: "Search drive by name.", input: z.object({ name: z.string() }), handler: async ({ name }) => (await client()).get<any>("files", { q: `name contains '${name.replace(/'/g, "\\'")}'`, pageSize: 50, fields: "files(id,name,mimeType,modifiedTime,webViewLink)" }) });
  server.tool({ name: "upload", description: "Create a text file in Drive.", input: z.object({ name: z.string(), content: z.string(), mimeType: z.string().optional() }), handler: async ({ name, content, mimeType = "text/plain" }) => {
    const t = await googleAccessToken();
    const boundary = "bmai" + Date.now();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
    return await r.json();
  }});
}

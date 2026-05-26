// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3", rps: 4 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search ICD-10-CM codes by term. Returns [count,[codes],null,[[code,desc]...]].",
    input: z.object({ terms: z.string().min(1), maxList: z.number().int().min(1).max(500).optional() }),
    handler: async ({ terms, maxList = 50 }) => {
      const r = await api.get<any>("search", { terms, maxList, sf: "code,name", df: "code,name" });
      return { query: terms, total: r?.[0], results: (r?.[3] || []).map((row: string[]) => ({ code: row[0], description: row[1] })) };
    },
  });
  server.tool({
    name: "lookup",
    description: "Look up a specific ICD-10-CM code.",
    input: z.object({ code: z.string() }),
    handler: async ({ code }) => {
      const r = await api.get<any>("search", { terms: code, sf: "code" });
      const rows = r?.[3] || [];
      return rows.length ? { code: rows[0][0], description: rows[0][1] } : { code, description: null };
    },
  });
}

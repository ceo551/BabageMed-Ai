import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.HF_API_TOKEN || "";
const api = new ApiClient({ base: "https://huggingface.co/api", rps: 3, defaultHeaders: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
export function registerTools(server: McpServer) {
  server.tool({ name: "models", description: "Search Hugging Face models.", input: z.object({ search: z.string().optional(), filter: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }), handler: async (q) => api.get<any>("models", { search: q.search, filter: q.filter, limit: q.limit ?? 20 }) });
  server.tool({ name: "datasets", description: "Search HF datasets.", input: z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }), handler: async (q) => api.get<any>("datasets", { search: q.search, limit: q.limit ?? 20 }) });
  server.tool({ name: "spaces", description: "Search HF spaces.", input: z.object({ search: z.string().optional() }), handler: async ({ search }) => api.get<any>("spaces", { search, limit: 20 }) });
  server.tool({ name: "infer", description: "Run inference on a public model.", input: z.object({ model: z.string(), inputs: z.unknown() }), handler: async ({ model, inputs }) => {
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ inputs }) });
    return await r.json();
  }});
}

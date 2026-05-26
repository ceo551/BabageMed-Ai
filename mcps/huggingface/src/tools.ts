// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const TOKEN = process.env.HF_API_TOKEN || "";
const api = new ApiClient({
  base: "https://huggingface.co/api",
  rps: 3,
  defaultHeaders: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
});

// Hugging Face model / dataset ids are "owner/name". Without this
// regex a value like `../../api/datasets` could rewrite the URL.
const modelIdSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must be owner/name");

export function registerTools(server: McpServer) {
  server.tool({
    name: "models",
    description: "Search Hugging Face models.",
    input: z.object({
      search: z.string().optional(),
      filter: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (q) => api.get<any>("models", { search: q.search, filter: q.filter, limit: q.limit ?? 20 }),
  });
  server.tool({
    name: "datasets",
    description: "Search HF datasets.",
    input: z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }),
    handler: async (q) => api.get<any>("datasets", { search: q.search, limit: q.limit ?? 20 }),
  });
  server.tool({
    name: "spaces",
    description: "Search HF spaces.",
    input: z.object({ search: z.string().optional() }),
    handler: async ({ search }) => api.get<any>("spaces", { search, limit: 20 }),
  });
  server.tool({
    name: "infer",
    description: "Run inference on a public model.",
    input: z.object({ model: modelIdSchema, inputs: z.unknown() }),
    handler: async ({ model, inputs }) => {
      // Build the URL with the validated model id. URL-encoded so any
      // unusual-but-allowed chars don't break the path.
      const url = `https://api-inference.huggingface.co/models/${model.split("/").map(encodeURIComponent).join("/")}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          // Don't send an empty Bearer — public models work anonymously,
          // and gated models will return a clearer "auth required" error.
          ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`HF infer ${r.status}: ${text.slice(0, 200)}`);
      }
      return await r.json();
    },
  });
}

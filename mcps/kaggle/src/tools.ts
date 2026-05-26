// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const USER = process.env.KAGGLE_USERNAME || "";
const KEY = process.env.KAGGLE_KEY || "";
// Build the Basic header only when both env vars are set. Previously
// `Basic Og==` (base64 ":") was attached to every request even with
// empty creds, leaking a useless-but-misleading credential.
const api = new ApiClient({
  base: "https://www.kaggle.com/api/v1",
  rps: 2,
  defaultHeaders: USER && KEY
    ? { Authorization: "Basic " + Buffer.from(`${USER}:${KEY}`).toString("base64") }
    : {},
});

function need() {
  if (!USER || !KEY) throw new Error("KAGGLE_USERNAME / KAGGLE_KEY required");
}

export function registerTools(server: McpServer) {
  server.tool({
    name: "datasets",
    description: "Search Kaggle datasets.",
    input: z.object({ search: z.string().optional(), page: z.number().int().min(1).max(1000).optional() }),
    handler: async ({ search, page = 1 }) => { need(); return api.get<any>("datasets/list", { search, page }); },
  });
  server.tool({
    name: "kernels",
    description: "Search Kaggle kernels.",
    input: z.object({ search: z.string().optional(), page: z.number().int().min(1).max(1000).optional() }),
    handler: async ({ search, page = 1 }) => { need(); return api.get<any>("kernels/list", { search, page }); },
  });
  server.tool({
    name: "competitions",
    description: "List Kaggle competitions.",
    input: z.object({ search: z.string().optional() }),
    handler: async ({ search }) => { need(); return api.get<any>("competitions/list", { search }); },
  });
}

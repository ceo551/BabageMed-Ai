import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://ghoapi.azureedge.net/api", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "indicators",
    description: "List WHO GHO indicators (or filter by substring).",
    input: z.object({ contains: z.string().optional() }),
    handler: async ({ contains }) => {
      const r = await api.get<any>("Indicator");
      const list = r.value || [];
      return contains ? list.filter((i: any) => (i.IndicatorName || "").toLowerCase().includes(contains.toLowerCase())) : list.slice(0, 200);
    },
  });
  server.tool({
    name: "country",
    description: "Get an indicator series for a country (ISO3).",
    input: z.object({ indicator: z.string().describe("e.g. WHOSIS_000001"), country: z.string().length(3) }),
    handler: async ({ indicator, country }) =>
      api.get<any>(indicator, { $filter: `SpatialDim eq '${country.toUpperCase()}'` }),
  });
  server.tool({
    name: "dimension",
    description: "List WHO dimensions.",
    input: z.object({}),
    handler: async () => api.get<any>("Dimension"),
  });
}

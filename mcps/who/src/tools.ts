// @hand-edited — do not regenerate via write-real-tools.mjs
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
    // Strict ISO3 — country/indicator both inline into the OData $filter.
    // Without these regexes a value like `XYZ' or '1' eq '1` would extend the
    // filter clause; the .length(3) alone wouldn't catch valid-shape junk.
    input: z.object({
      indicator: z.string().regex(/^[A-Za-z0-9_]+$/, "indicator must be alphanumeric/underscore"),
      country: z.string().regex(/^[A-Za-z]{3}$/, "country must be 3 letters"),
    }),
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

import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://clinicaltrials.gov/api/v2", rps: 4 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search ClinicalTrials.gov for studies.",
    input: z.object({
      query: z.string().min(1),
      status: z.enum(["RECRUITING","COMPLETED","ACTIVE_NOT_RECRUITING","NOT_YET_RECRUITING","TERMINATED"]).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    }),
    handler: async ({ query, status, pageSize = 20 }) => {
      const r = await api.get<any>("studies", {
        "query.term": query,
        "filter.overallStatus": status,
        pageSize,
        fields: "NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName,LeadSponsorName,StartDate,CompletionDate",
      });
      return { totalCount: r.totalCount, studies: r.studies?.map((s: any) => s.protocolSection?.identificationModule) };
    },
  });
  server.tool({
    name: "study",
    description: "Fetch a single study by NCT ID.",
    input: z.object({ nctId: z.string().regex(/^NCT\d+$/i) }),
    handler: async ({ nctId }) => api.get<any>(`studies/${nctId.toUpperCase()}`),
  });
  server.tool({
    name: "fields",
    description: "Get the field definitions exposed by ClinicalTrials.gov API.",
    input: z.object({}),
    handler: async () => api.get<any>("studies/metadata"),
  });
}

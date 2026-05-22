import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://pubchem.ncbi.nlm.nih.gov/rest/pug", rps: 4 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "compound",
    description: "Find a compound by name and return basic properties + CID.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => {
      const cidR = await api.get<any>(`compound/name/${encodeURIComponent(name)}/cids/JSON`);
      const cid = cidR?.IdentifierList?.CID?.[0];
      if (!cid) return { name, cid: null };
      const props = await api.get<any>(`compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChI,InChIKey,XLogP,HBondDonorCount,HBondAcceptorCount/JSON`);
      return { name, cid, properties: props?.PropertyTable?.Properties?.[0] };
    },
  });
  server.tool({
    name: "substance",
    description: "Search PubChem substances.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => api.get<any>(`substance/name/${encodeURIComponent(name)}/sids/JSON`),
  });
  server.tool({
    name: "assay",
    description: "Search assays by gene target symbol.",
    input: z.object({ target: z.string().min(1) }),
    handler: async ({ target }) => api.get<any>(`assay/target/genesymbol/${encodeURIComponent(target)}/aids/JSON`),
  });
}

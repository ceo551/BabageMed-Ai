#!/usr/bin/env node
// Writes real (non-fallback) tools.ts for MCPs that have well-documented public APIs.
// Run AFTER generate-mcps.mjs. Will overwrite fallback files.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function w(id, body) {
  const p = join(ROOT, "mcps", id, "src", "tools.ts");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

// ─── ICD-10 (NLM Clinical Tables) ─────────────────────────────────────────
w("icd10", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
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
`);

// ─── ClinicalTrials.gov v2 ─────────────────────────────────────────────────
w("clinicaltrials", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
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
    input: z.object({ nctId: z.string().regex(/^NCT\\d+$/i) }),
    handler: async ({ nctId }) => api.get<any>(\`studies/\${nctId.toUpperCase()}\`),
  });
  server.tool({
    name: "fields",
    description: "Get the field definitions exposed by ClinicalTrials.gov API.",
    input: z.object({}),
    handler: async () => api.get<any>("studies/metadata"),
  });
}
`);

// ─── openFDA (drugs/devices/food/events/labels) ────────────────────────────
w("fda", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://api.fda.gov", rps: 4 });
const KEY = process.env.OPENFDA_API_KEY;
function withKey(q: Record<string, any>) { return KEY ? { ...q, api_key: KEY } : q; }
export function registerTools(server: McpServer) {
  for (const [name, endpoint] of [["drug","drug/label.json"],["event","drug/event.json"],["device","device/event.json"],["food","food/enforcement.json"]] as const) {
    server.tool({
      name,
      description: \`openFDA \${name} search.\`,
      input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(100).optional() }),
      handler: async ({ query, limit = 10 }) => api.get<any>(endpoint, withKey({ search: query, limit })),
    });
  }
  server.tool({
    name: "label",
    description: "Look up a drug label by brand or generic name.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => {
      return api.get<any>("drug/label.json", withKey({
        search: \`openfda.brand_name:"\${name}" OR openfda.generic_name:"\${name}"\`,
        limit: 5,
      }));
    },
  });
}
`);

// ─── DailyMed ──────────────────────────────────────────────────────────────
w("dailymed", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://dailymed.nlm.nih.gov/dailymed/services/v2", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "spls",
    description: "Search Structured Product Labels (SPLs).",
    input: z.object({ drug_name: z.string().optional(), setid: z.string().optional(), page: z.number().int().min(1).optional() }),
    handler: async ({ drug_name, setid, page = 1 }) => api.get<any>("spls.json", { drug_name, setid, page, pagesize: 25 }),
  });
  server.tool({
    name: "drugnames",
    description: "List drug names matching a query.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => api.get<any>("drugnames.json", { drug_name: name, pagesize: 50 }),
  });
  server.tool({
    name: "ndc",
    description: "Look up an NDC.",
    input: z.object({ ndc: z.string() }),
    handler: async ({ ndc }) => api.get<any>("ndcs.json", { ndc }),
  });
}
`);

// ─── MedlinePlus Connect / Health Topics ───────────────────────────────────
w("medlineplus", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://wsearch.nlm.nih.gov", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search MedlinePlus health topics.",
    input: z.object({ term: z.string().min(1), retmax: z.number().int().min(1).max(50).optional() }),
    handler: async ({ term, retmax = 10 }) => {
      const xml = await api.get<string>("/api/healthTopics", { db: "healthTopics", term, retmax, rettype: "brief" });
      return { format: "xml", xml };
    },
  });
  server.tool({
    name: "health",
    description: "Find a health topic page summary.",
    input: z.object({ term: z.string().min(1) }),
    handler: async ({ term }) => {
      const xml = await api.get<string>("/api/healthTopics", { db: "healthTopics", term, retmax: 5 });
      return { format: "xml", xml };
    },
  });
  server.tool({
    name: "drug",
    description: "Find drug info.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => {
      const xml = await api.get<string>("/api/healthTopics", { db: "healthTopics", term: name + " drug", retmax: 5 });
      return { format: "xml", xml };
    },
  });
}
`);

// ─── PubChem PUG REST ──────────────────────────────────────────────────────
w("pubchem", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://pubchem.ncbi.nlm.nih.gov/rest/pug", rps: 4 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "compound",
    description: "Find a compound by name and return basic properties + CID.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => {
      const cidR = await api.get<any>(\`compound/name/\${encodeURIComponent(name)}/cids/JSON\`);
      const cid = cidR?.IdentifierList?.CID?.[0];
      if (!cid) return { name, cid: null };
      const props = await api.get<any>(\`compound/cid/\${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChI,InChIKey,XLogP,HBondDonorCount,HBondAcceptorCount/JSON\`);
      return { name, cid, properties: props?.PropertyTable?.Properties?.[0] };
    },
  });
  server.tool({
    name: "substance",
    description: "Search PubChem substances.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => api.get<any>(\`substance/name/\${encodeURIComponent(name)}/sids/JSON\`),
  });
  server.tool({
    name: "assay",
    description: "Search assays by gene target symbol.",
    input: z.object({ target: z.string().min(1) }),
    handler: async ({ target }) => api.get<any>(\`assay/target/genesymbol/\${encodeURIComponent(target)}/aids/JSON\`),
  });
}
`);

// ─── ChEMBL ────────────────────────────────────────────────────────────────
w("chembl", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://www.ebi.ac.uk/chembl/api/data", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "molecule",
    description: "Search molecules by preferred name.",
    input: z.object({ name: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ name, limit = 20 }) => api.get<any>("molecule.json", { pref_name__icontains: name, limit }),
  });
  server.tool({
    name: "target",
    description: "Search ChEMBL targets.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 20 }) => api.get<any>("target.json", { pref_name__icontains: query, limit }),
  });
  server.tool({
    name: "activity",
    description: "Fetch activity records for a ChEMBL molecule.",
    input: z.object({ chembl_id: z.string(), limit: z.number().int().min(1).max(100).optional() }),
    handler: async ({ chembl_id, limit = 25 }) => api.get<any>("activity.json", { molecule_chembl_id: chembl_id, limit }),
  });
}
`);

// ─── WHO GHO OData ────────────────────────────────────────────────────────
w("who", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
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
      api.get<any>(indicator, { $filter: \`SpatialDim eq '\${country.toUpperCase()}'\` }),
  });
  server.tool({
    name: "dimension",
    description: "List WHO dimensions.",
    input: z.object({}),
    handler: async () => api.get<any>("Dimension"),
  });
}
`);

// ─── CDC Socrata ──────────────────────────────────────────────────────────
w("cdc", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.SOCRATA_APP_TOKEN;
const api = new ApiClient({
  base: "https://data.cdc.gov/resource",
  rps: 3,
  defaultHeaders: TOKEN ? { "X-App-Token": TOKEN } : {},
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "dataset",
    description: "Query a specific CDC Socrata dataset by 4x4 code.",
    input: z.object({
      datasetId: z.string().regex(/^[a-z0-9]{4}-[a-z0-9]{4}$/i),
      where: z.string().optional(),
      select: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().int().min(1).max(50000).optional(),
    }),
    handler: async ({ datasetId, where, select, order, limit = 100 }) =>
      api.get<any>(\`\${datasetId}.json\`, { $where: where, $select: select, $order: order, $limit: limit }),
  });
  server.tool({
    name: "search",
    description: "Search CDC data.cdc.gov for datasets matching a query.",
    input: z.object({ query: z.string().min(1) }),
    handler: async ({ query }) => {
      const r: any = await fetch(\`https://api.us.socrata.com/api/catalog/v1?domains=data.cdc.gov&q=\${encodeURIComponent(query)}&limit=20\`).then((r) => r.json());
      return { count: r.resultSetSize, results: r.results?.map((x: any) => ({ name: x.resource?.name, id: x.resource?.id, desc: x.resource?.description, url: x.permalink })) };
    },
  });
  server.tool({
    name: "row",
    description: "Fetch a single row from a dataset by row identifier.",
    input: z.object({ datasetId: z.string(), id: z.string() }),
    handler: async ({ datasetId, id }) => api.get<any>(\`\${datasetId}.json\`, { $where: \`\${id}\` }),
  });
}
`);

// ─── NPI Registry ─────────────────────────────────────────────────────────
w("npi", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://npiregistry.cms.hhs.gov/api", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search the NPPES NPI registry.",
    input: z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      organization_name: z.string().optional(),
      city: z.string().optional(),
      state: z.string().length(2).optional(),
      postal_code: z.string().optional(),
      taxonomy_description: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (i) => api.get<any>("", { version: "2.1", ...i, limit: i.limit ?? 20 }),
  });
  server.tool({
    name: "lookup",
    description: "Look up a provider by NPI number.",
    input: z.object({ number: z.string() }),
    handler: async ({ number }) => api.get<any>("", { version: "2.1", number }),
  });
}
`);

// ─── NCI EVS ──────────────────────────────────────────────────────────────
w("nci", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://api-evsrest.nci.nih.gov/api/v1", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "concept",
    description: "Get a concept by code in NCI Thesaurus (ncit).",
    input: z.object({ code: z.string() }),
    handler: async ({ code }) => api.get<any>(\`concept/ncit/\${code}\`),
  });
  server.tool({
    name: "search",
    description: "Search NCI Thesaurus.",
    input: z.object({ term: z.string().min(1), terminology: z.string().optional(), pageSize: z.number().int().min(1).max(100).optional() }),
    handler: async ({ term, terminology = "ncit", pageSize = 20 }) =>
      api.get<any>("concept/search", { terminology, term, type: "match", pageSize }),
  });
  server.tool({
    name: "ncit",
    description: "Walk NCI Thesaurus parents and children for a code.",
    input: z.object({ code: z.string() }),
    handler: async ({ code }) => {
      const [parents, children] = await Promise.all([
        api.get<any>(\`concept/ncit/\${code}/parents\`),
        api.get<any>(\`concept/ncit/\${code}/children\`),
      ]);
      return { code, parents, children };
    },
  });
}
`);

// ─── medRxiv / bioRxiv ────────────────────────────────────────────────────
function rxivTools(server, channel) {
  return `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://api.biorxiv.org", rps: 2 });
const CHANNEL = "${channel}";
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search ${channel} preprints by interval (YYYY-MM-DD/YYYY-MM-DD) or by DOI.",
    input: z.object({ interval: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}\\/\\d{4}-\\d{2}-\\d{2}$/).optional(), doi: z.string().optional(), cursor: z.number().int().min(0).optional() }),
    handler: async ({ interval, doi, cursor = 0 }) => {
      if (doi) return api.get<any>(\`details/\${CHANNEL}/\${doi}/na/json\`);
      if (!interval) {
        const today = new Date().toISOString().slice(0, 10);
        const old = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
        interval = \`\${old}/\${today}\`;
      }
      return api.get<any>(\`details/\${CHANNEL}/\${interval}/\${cursor}/json\`);
    },
  });
  server.tool({
    name: "details",
    description: "Fetch full record for a DOI.",
    input: z.object({ doi: z.string() }),
    handler: async ({ doi }) => api.get<any>(\`details/\${CHANNEL}/\${doi}/na/json\`),
  });
}
`;
}
w("medrxiv", rxivTools("medrxiv", "medrxiv"));
w("biorxiv", rxivTools("biorxiv", "biorxiv"));

// ─── NHS ──────────────────────────────────────────────────────────────────
w("nhs", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const KEY = process.env.NHS_API_KEY || "";
const api = new ApiClient({
  base: "https://api.nhs.uk",
  rps: 2,
  defaultHeaders: KEY ? { "subscription-key": KEY, apikey: KEY } : {},
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "conditions",
    description: "Look up an NHS condition page.",
    input: z.object({ slug: z.string().describe("e.g. 'high-blood-pressure-hypertension'") }),
    handler: async ({ slug }) => api.get<any>(\`conditions/\${slug}\`),
  });
  server.tool({
    name: "medicines",
    description: "Look up an NHS medicine page.",
    input: z.object({ slug: z.string() }),
    handler: async ({ slug }) => api.get<any>(\`medicines/\${slug}\`),
  });
  server.tool({
    name: "live-well",
    description: "Look up NHS Live Well topic.",
    input: z.object({ slug: z.string() }),
    handler: async ({ slug }) => api.get<any>(\`live-well/\${slug}\`),
  });
}
`);
// nhs2 mirrors nhs — keep an independent copy (re-export across rootDir boundaries breaks TS)
w("nhs2", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const KEY = process.env.NHS_API_KEY || "";
const api = new ApiClient({ base: "https://api.nhs.uk", rps: 2, defaultHeaders: KEY ? { "subscription-key": KEY, apikey: KEY } : {} });
export function registerTools(server: McpServer) {
  server.tool({ name: "conditions", description: "Look up an NHS condition page.", input: z.object({ slug: z.string() }), handler: async ({ slug }) => api.get<any>(\`conditions/\${slug}\`) });
  server.tool({ name: "medicines", description: "Look up an NHS medicine.", input: z.object({ slug: z.string() }), handler: async ({ slug }) => api.get<any>(\`medicines/\${slug}\`) });
  server.tool({ name: "live-well", description: "Look up Live Well topic.", input: z.object({ slug: z.string() }), handler: async ({ slug }) => api.get<any>(\`live-well/\${slug}\`) });
}
`);

// ─── NCBI E-utilities (general) ───────────────────────────────────────────
w("ncbi", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils", rps: process.env.NCBI_API_KEY ? 9 : 2 });
const KEY = process.env.NCBI_API_KEY;
function base() { const q: Record<string,string> = { tool: "BabageMedAI", email: process.env.NCBI_EMAIL || "ceo@babagemed.com", retmode: "json" }; if (KEY) q.api_key = KEY; return q; }
export function registerTools(server: McpServer) {
  server.tool({ name: "einfo", description: "List NCBI databases or describe one.", input: z.object({ db: z.string().optional() }), handler: async ({ db }) => api.get<any>("einfo.fcgi", { ...base(), db }) });
  server.tool({ name: "esearch", description: "Search any NCBI DB.", input: z.object({ db: z.string(), term: z.string(), retmax: z.number().int().min(1).max(500).optional() }), handler: async ({ db, term, retmax = 20 }) => api.get<any>("esearch.fcgi", { ...base(), db, term, retmax }) });
  server.tool({ name: "efetch", description: "Fetch records by ID list.", input: z.object({ db: z.string(), id: z.string(), rettype: z.string().optional(), retmode: z.string().optional() }), handler: async ({ db, id, rettype, retmode }) => api.get<any>("efetch.fcgi", { ...base(), db, id, rettype, retmode }) });
  server.tool({ name: "elink", description: "Find linked records between DBs.", input: z.object({ dbfrom: z.string(), db: z.string(), id: z.string() }), handler: async ({ dbfrom, db, id }) => api.get<any>("elink.fcgi", { ...base(), dbfrom, db, id }) });
  server.tool({ name: "esummary", description: "Get document summaries.", input: z.object({ db: z.string(), id: z.string() }), handler: async ({ db, id }) => api.get<any>("esummary.fcgi", { ...base(), db, id }) });
}
`);

// ─── Endotext via NCBI Bookshelf E-utilities ──────────────────────────────
w("endotext", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils", rps: 3 });
const KEY = process.env.NCBI_API_KEY;
function base() { const q: Record<string,string> = { tool: "BabageMedAI", email: process.env.NCBI_EMAIL || "ceo@babagemed.com", db: "books", retmode: "json" }; if (KEY) q.api_key = KEY; return q; }
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Endotext (NCBI Bookshelf, NBK279071) by topic.",
    input: z.object({ term: z.string().min(1), retmax: z.number().int().min(1).max(100).optional() }),
    handler: async ({ term, retmax = 20 }) => {
      const r = await api.get<any>("esearch.fcgi", { ...base(), term: \`\${term} AND endotext[book]\`, retmax });
      return { ids: r?.esearchresult?.idlist ?? [], count: Number(r?.esearchresult?.count || 0) };
    },
  });
  server.tool({
    name: "chapter",
    description: "Fetch chapter metadata by Bookshelf ID.",
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => api.get<any>("esummary.fcgi", { ...base(), id }),
  });
}
`);

// ─── WikEM / EyeWiki (MediaWiki) ──────────────────────────────────────────
function mediawikiTools(api) {
  return `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "${api}", rps: 2 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "MediaWiki opensearch.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(30).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const r = await api.get<any>("", { action: "opensearch", search: query, limit, format: "json" });
      const [q, titles, snippets, urls] = r;
      return { query: q, results: (titles || []).map((t: string, i: number) => ({ title: t, snippet: snippets?.[i], url: urls?.[i] })) };
    },
  });
  server.tool({
    name: "page",
    description: "Fetch wiki page wikitext + extract.",
    input: z.object({ title: z.string() }),
    handler: async ({ title }) => api.get<any>("", { action: "query", prop: "extracts|info", explaintext: 1, inprop: "url", titles: title, format: "json" }),
  });
}
`;
}
w("wikem", mediawikiTools("https://wikem.org/w/api.php"));
w("eyewiki", mediawikiTools("https://eyewiki.org/w/api.php"));

// ─── CMS data ──────────────────────────────────────────────────────────────
w("cms", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://data.cms.gov", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "dataset",
    description: "Get a CMS dataset by id.",
    input: z.object({ id: z.string(), limit: z.number().int().min(1).max(10000).optional() }),
    handler: async ({ id, limit = 200 }) => api.get<any>(\`data-api/v1/dataset/\${id}/data\`, { size: limit }),
  });
  server.tool({
    name: "coverage",
    description: "Search Medicare coverage policies (LCD/NCD) via CMS Coverage MCD JSON.",
    input: z.object({ query: z.string().min(1) }),
    handler: async ({ query }) => {
      const r: any = await fetch(\`https://www.cms.gov/medicare-coverage-database/api/search?keyword=\${encodeURIComponent(query)}\`).then((r) => r.json()).catch(() => ({}));
      return r;
    },
  });
  server.tool({
    name: "lcd",
    description: "Look up a Local Coverage Determination by id.",
    input: z.object({ lcdId: z.string() }),
    handler: async ({ lcdId }): Promise<any> => fetch(\`https://www.cms.gov/medicare-coverage-database/api/lcd/\${encodeURIComponent(lcdId)}\`).then((r) => r.json()),
  });
  server.tool({
    name: "ncd",
    description: "Look up a National Coverage Determination by id.",
    input: z.object({ ncdId: z.string() }),
    handler: async ({ ncdId }): Promise<any> => fetch(\`https://www.cms.gov/medicare-coverage-database/api/ncd/\${encodeURIComponent(ncdId)}\`).then((r) => r.json()),
  });
}
`);

// ─── Crossref-backed journal MCPs (NEJM, BMJ, Frontiers, RMD Open, Cochrane) ─
function crossrefTools(label, container) {
  return `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const cr = new ApiClient({ base: "https://api.crossref.org", rps: 2, defaultHeaders: { "User-Agent": \`BabageMedAI (mailto:\${process.env.CROSSREF_MAILTO || "ceo@babagemed.com"})\` } });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search ${label} via Crossref.",
    input: z.object({ query: z.string().min(1), rows: z.number().int().min(1).max(100).optional() }),
    handler: async ({ query, rows = 20 }) => {
      const r = await cr.get<any>("works", { query, rows, "filter": "container-title:" + ${JSON.stringify(container)} });
      return { count: r?.message?.["total-results"], items: (r?.message?.items || []).map((w: any) => ({ doi: w.DOI, title: (w.title || [])[0], year: w.created?.["date-parts"]?.[0]?.[0], journal: (w["container-title"] || [])[0], url: w.URL, abstract: w.abstract })) };
    },
  });
  server.tool({
    name: "article",
    description: "Fetch a Crossref work by DOI.",
    input: z.object({ doi: z.string() }),
    handler: async ({ doi }) => cr.get<any>(\`works/\${encodeURIComponent(doi)}\`),
  });
  ${ label === "Cochrane" ? `
  server.tool({
    name: "review",
    description: "Fetch metadata for a Cochrane review DOI.",
    input: z.object({ doi: z.string() }),
    handler: async ({ doi }) => cr.get<any>(\`works/\${encodeURIComponent(doi)}\`),
  });
  ` : "" }
}
`;
}
w("nejm",      crossrefTools("NEJM",      "The New England Journal of Medicine"));
w("bmj",       crossrefTools("The BMJ",   "BMJ"));
w("frontiers", crossrefTools("Frontiers", "Frontiers in Medicine"));
w("rmopen",    crossrefTools("RMD Open",  "RMD Open"));
w("cochrane",  crossrefTools("Cochrane",  "Cochrane Database of Systematic Reviews"));

// ─── Notion ───────────────────────────────────────────────────────────────
w("notion", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.NOTION_TOKEN || "";
const api = new ApiClient({
  base: "https://api.notion.com/v1",
  rps: 3,
  defaultHeaders: { Authorization: \`Bearer \${TOKEN}\`, "Notion-Version": "2022-06-28" },
});
function need() { if (!TOKEN) throw new Error("NOTION_TOKEN not configured"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "search", description: "Search Notion workspace.", input: z.object({ query: z.string() }), handler: async ({ query }) => { need(); return api.post<any>("search", { query, page_size: 20 }); } });
  server.tool({ name: "page", description: "Fetch a Notion page.", input: z.object({ id: z.string() }), handler: async ({ id }) => { need(); return api.get<any>(\`pages/\${id}\`); } });
  server.tool({ name: "database", description: "Query a Notion database.", input: z.object({ id: z.string(), filter: z.unknown().optional() }), handler: async ({ id, filter }) => { need(); return api.post<any>(\`databases/\${id}/query\`, filter ? { filter } : {}); } });
  server.tool({ name: "create", description: "Create a page under a parent (page or database).", input: z.object({ parent: z.object({ database_id: z.string().optional(), page_id: z.string().optional() }), properties: z.unknown(), children: z.unknown().optional() }), handler: async (b) => { need(); return api.post<any>("pages", b); } });
}
`);

// ─── Slack ────────────────────────────────────────────────────────────────
w("slack", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.SLACK_BOT_TOKEN || "";
const api = new ApiClient({ base: "https://slack.com/api", rps: 3, defaultHeaders: { Authorization: \`Bearer \${TOKEN}\`, "Content-Type": "application/x-www-form-urlencoded" } });
function need() { if (!TOKEN) throw new Error("SLACK_BOT_TOKEN not configured"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "post", description: "Post a message to a Slack channel.", input: z.object({ channel: z.string(), text: z.string() }), handler: async ({ channel, text }) => { need(); return api.post<any>("chat.postMessage", { channel, text }); } });
  server.tool({ name: "search", description: "Search Slack messages.", input: z.object({ query: z.string() }), handler: async ({ query }) => { need(); return api.get<any>("search.messages", { query }); } });
  server.tool({ name: "channels", description: "List Slack channels.", input: z.object({ limit: z.number().int().min(1).max(1000).optional() }), handler: async ({ limit = 100 }) => { need(); return api.get<any>("conversations.list", { limit }); } });
}
`);

// ─── Kaggle ───────────────────────────────────────────────────────────────
w("kaggle", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const USER = process.env.KAGGLE_USERNAME || "";
const KEY = process.env.KAGGLE_KEY || "";
const auth = "Basic " + Buffer.from(\`\${USER}:\${KEY}\`).toString("base64");
const api = new ApiClient({ base: "https://www.kaggle.com/api/v1", rps: 2, defaultHeaders: { Authorization: auth } });
function need() { if (!USER || !KEY) throw new Error("KAGGLE_USERNAME / KAGGLE_KEY required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "datasets", description: "Search Kaggle datasets.", input: z.object({ search: z.string().optional(), page: z.number().int().min(1).optional() }), handler: async ({ search, page = 1 }) => { need(); return api.get<any>("datasets/list", { search, page }); } });
  server.tool({ name: "kernels", description: "Search Kaggle kernels.", input: z.object({ search: z.string().optional(), page: z.number().int().min(1).optional() }), handler: async ({ search, page = 1 }) => { need(); return api.get<any>("kernels/list", { search, page }); } });
  server.tool({ name: "competitions", description: "List Kaggle competitions.", input: z.object({ search: z.string().optional() }), handler: async ({ search }) => { need(); return api.get<any>("competitions/list", { search }); } });
}
`);

// ─── LinkedIn (limited official API) ─────────────────────────────────────
w("linkedin", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
const api = new ApiClient({ base: "https://api.linkedin.com/v2", rps: 1, defaultHeaders: { Authorization: \`Bearer \${TOKEN}\`, "X-Restli-Protocol-Version": "2.0.0" } });
function need() { if (!TOKEN) throw new Error("LINKEDIN_ACCESS_TOKEN required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "me", description: "Get the authenticated LinkedIn profile.", input: z.object({}), handler: async () => { need(); return api.get<any>("userinfo"); } });
  server.tool({ name: "posts", description: "List the authenticated member's posts.", input: z.object({ author: z.string().describe("urn:li:person:..."), count: z.number().int().min(1).max(50).optional() }), handler: async ({ author, count = 10 }) => { need(); return api.get<any>("ugcPosts", { q: "authors", authors: author, count }); } });
  server.tool({ name: "share", description: "Share a text post.", input: z.object({ author: z.string(), text: z.string() }), handler: async ({ author, text }) => { need(); return api.post<any>("ugcPosts", { author, lifecycleState: "PUBLISHED", specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text }, shareMediaCategory: "NONE" } }, visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } }); } });
}
`);

// ─── Google APIs share an OAuth refresh-token helper (copied per-package to respect rootDir) ──
const googleHelper = `let cachedToken: { value: string; exp: number } | null = null;
export async function googleAccessToken(): Promise<string> {
  const cid = process.env.GOOGLE_CLIENT_ID;
  const cs = process.env.GOOGLE_CLIENT_SECRET;
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  if (!cid || !cs || !rt) throw new Error("GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN required");
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.value;
  const body = new URLSearchParams({ client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" });
  const r: any = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }).then((r) => r.json());
  cachedToken = { value: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
  return cachedToken.value;
}
`;
import { mkdirSync as mk2 } from "node:fs";
mk2(join(ROOT, "mcps", "_shared", "src"), { recursive: true });
writeFileSync(join(ROOT, "mcps", "_shared", "src", "google.ts"), googleHelper);
for (const g of ["gmail", "gcalendar", "gdrive"]) {
  mk2(join(ROOT, "mcps", g, "src"), { recursive: true });
  writeFileSync(join(ROOT, "mcps", g, "src", "google.ts"), googleHelper);
}

w("gmail", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
import { googleAccessToken } from "./google.js";
async function client() { const t = await googleAccessToken(); return new ApiClient({ base: "https://gmail.googleapis.com/gmail/v1", rps: 3, defaultHeaders: { Authorization: \`Bearer \${t}\` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "list", description: "List Gmail messages.", input: z.object({ q: z.string().optional(), maxResults: z.number().int().min(1).max(500).optional() }), handler: async ({ q, maxResults = 20 }) => (await client()).get<any>("users/me/messages", { q, maxResults }) });
  server.tool({ name: "get", description: "Get a single message.", input: z.object({ id: z.string() }), handler: async ({ id }) => (await client()).get<any>(\`users/me/messages/\${id}\`) });
  server.tool({ name: "search", description: "Search Gmail.", input: z.object({ q: z.string() }), handler: async ({ q }) => (await client()).get<any>("users/me/messages", { q, maxResults: 50 }) });
  server.tool({ name: "send", description: "Send a Gmail message (raw MIME or simple to/subject/body).", input: z.object({ to: z.string(), subject: z.string(), body: z.string() }), handler: async ({ to, subject, body }) => {
    const mime = \`From: me\\nTo: \${to}\\nSubject: \${subject}\\nContent-Type: text/plain; charset=UTF-8\\n\\n\${body}\`;
    const raw = Buffer.from(mime).toString("base64url");
    return (await client()).post<any>("users/me/messages/send", { raw });
  }});
}
`);

w("gcalendar", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
import { googleAccessToken } from "./google.js";
async function client() { const t = await googleAccessToken(); return new ApiClient({ base: "https://www.googleapis.com/calendar/v3", rps: 3, defaultHeaders: { Authorization: \`Bearer \${t}\` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "list", description: "List upcoming events.", input: z.object({ calendarId: z.string().optional(), maxResults: z.number().int().min(1).max(2500).optional(), timeMin: z.string().optional() }), handler: async ({ calendarId = "primary", maxResults = 20, timeMin }) => (await client()).get<any>(\`calendars/\${calendarId}/events\`, { maxResults, timeMin: timeMin || new Date().toISOString(), singleEvents: true, orderBy: "startTime" }) });
  server.tool({ name: "create", description: "Create an event.", input: z.object({ calendarId: z.string().optional(), event: z.unknown() }), handler: async ({ calendarId = "primary", event }) => (await client()).post<any>(\`calendars/\${calendarId}/events\`, event) });
  server.tool({ name: "update", description: "Update an event.", input: z.object({ calendarId: z.string().optional(), eventId: z.string(), event: z.unknown() }), handler: async ({ calendarId = "primary", eventId, event }) => (await client()).request<any>(\`calendars/\${calendarId}/events/\${eventId}\`, { method: "PATCH", body: event }) });
  server.tool({ name: "delete", description: "Delete an event.", input: z.object({ calendarId: z.string().optional(), eventId: z.string() }), handler: async ({ calendarId = "primary", eventId }) => (await client()).request<any>(\`calendars/\${calendarId}/events/\${eventId}\`, { method: "DELETE" }) });
}
`);

w("gdrive", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
import { googleAccessToken } from "./google.js";
async function client() { const t = await googleAccessToken(); return new ApiClient({ base: "https://www.googleapis.com/drive/v3", rps: 3, defaultHeaders: { Authorization: \`Bearer \${t}\` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "list", description: "List files.", input: z.object({ q: z.string().optional(), pageSize: z.number().int().min(1).max(1000).optional() }), handler: async ({ q, pageSize = 20 }) => (await client()).get<any>("files", { q, pageSize, fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)" }) });
  server.tool({ name: "get", description: "Get a file metadata.", input: z.object({ id: z.string() }), handler: async ({ id }) => (await client()).get<any>(\`files/\${id}\`, { fields: "id,name,mimeType,modifiedTime,size,webViewLink,parents" }) });
  server.tool({ name: "search", description: "Search drive by name.", input: z.object({ name: z.string() }), handler: async ({ name }) => (await client()).get<any>("files", { q: \`name contains '\${name.replace(/'/g, "\\\\'")}'\`, pageSize: 50, fields: "files(id,name,mimeType,modifiedTime,webViewLink)" }) });
  server.tool({ name: "upload", description: "Create a text file in Drive.", input: z.object({ name: z.string(), content: z.string(), mimeType: z.string().optional() }), handler: async ({ name, content, mimeType = "text/plain" }) => {
    const t = await googleAccessToken();
    const boundary = "bmai" + Date.now();
    const body = \`--\${boundary}\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n\${JSON.stringify({ name, mimeType })}\\r\\n--\${boundary}\\r\\nContent-Type: \${mimeType}\\r\\n\\r\\n\${content}\\r\\n--\${boundary}--\`;
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", headers: { Authorization: \`Bearer \${t}\`, "Content-Type": \`multipart/related; boundary=\${boundary}\` }, body });
    return await r.json();
  }});
}
`);

// ─── GitHub ───────────────────────────────────────────────────────────────
w("github", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.GITHUB_TOKEN || "";
const api = new ApiClient({ base: "https://api.github.com", rps: 4, defaultHeaders: TOKEN ? { Authorization: \`Bearer \${TOKEN}\`, "X-GitHub-Api-Version": "2022-11-28" } : {} });
export function registerTools(server: McpServer) {
  server.tool({ name: "repos", description: "List repos for user.", input: z.object({ user: z.string().optional() }), handler: async ({ user }) => api.get<any>(user ? \`users/\${user}/repos\` : "user/repos") });
  server.tool({ name: "issues", description: "List issues for a repo.", input: z.object({ owner: z.string(), repo: z.string(), state: z.enum(["open","closed","all"]).optional() }), handler: async ({ owner, repo, state = "open" }) => api.get<any>(\`repos/\${owner}/\${repo}/issues\`, { state }) });
  server.tool({ name: "prs", description: "List PRs for a repo.", input: z.object({ owner: z.string(), repo: z.string(), state: z.enum(["open","closed","all"]).optional() }), handler: async ({ owner, repo, state = "open" }) => api.get<any>(\`repos/\${owner}/\${repo}/pulls\`, { state }) });
  server.tool({ name: "search", description: "GitHub search.", input: z.object({ q: z.string(), type: z.enum(["code","issues","repositories","users","commits"]).optional() }), handler: async ({ q, type = "repositories" }) => api.get<any>(\`search/\${type}\`, { q }) });
}
`);

// ─── Hugging Face ─────────────────────────────────────────────────────────
w("huggingface", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.HF_API_TOKEN || "";
const api = new ApiClient({ base: "https://huggingface.co/api", rps: 3, defaultHeaders: TOKEN ? { Authorization: \`Bearer \${TOKEN}\` } : {} });
export function registerTools(server: McpServer) {
  server.tool({ name: "models", description: "Search Hugging Face models.", input: z.object({ search: z.string().optional(), filter: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }), handler: async (q) => api.get<any>("models", { search: q.search, filter: q.filter, limit: q.limit ?? 20 }) });
  server.tool({ name: "datasets", description: "Search HF datasets.", input: z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }), handler: async (q) => api.get<any>("datasets", { search: q.search, limit: q.limit ?? 20 }) });
  server.tool({ name: "spaces", description: "Search HF spaces.", input: z.object({ search: z.string().optional() }), handler: async ({ search }) => api.get<any>("spaces", { search, limit: 20 }) });
  server.tool({ name: "infer", description: "Run inference on a public model.", input: z.object({ model: z.string(), inputs: z.unknown() }), handler: async ({ model, inputs }) => {
    const r = await fetch(\`https://api-inference.huggingface.co/models/\${model}\`, { method: "POST", headers: { Authorization: \`Bearer \${TOKEN}\`, "Content-Type": "application/json" }, body: JSON.stringify({ inputs }) });
    return await r.json();
  }});
}
`);

// ─── Microsoft Graph (Microsoft 365) ──────────────────────────────────────
w("ms365", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
let cached: { v: string; exp: number } | null = null;
async function token() {
  const cid = process.env.MS365_CLIENT_ID;
  const cs = process.env.MS365_CLIENT_SECRET;
  const tid = process.env.MS365_TENANT_ID;
  const rt = process.env.MS365_REFRESH_TOKEN;
  if (!cid || !cs || !tid) throw new Error("MS365_CLIENT_ID/SECRET/TENANT_ID required");
  if (cached && cached.exp > Date.now()) return cached.v;
  const body = new URLSearchParams(rt ? { client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" } : { client_id: cid, client_secret: cs, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" });
  const r: any = await fetch(\`https://login.microsoftonline.com/\${tid}/oauth2/v2.0/token\`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }).then((r) => r.json());
  cached = { v: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
  return cached.v;
}
async function client() { return new ApiClient({ base: "https://graph.microsoft.com/v1.0", rps: 3, defaultHeaders: { Authorization: \`Bearer \${await token()}\` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "me", description: "Get current user.", input: z.object({}), handler: async () => (await client()).get<any>("me") });
  server.tool({ name: "mail", description: "List Outlook messages.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }) => (await client()).get<any>("me/messages", { $top: top }) });
  server.tool({ name: "calendar", description: "List calendar events.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }) => (await client()).get<any>("me/events", { $top: top }) });
  server.tool({ name: "files", description: "List OneDrive root items.", input: z.object({}), handler: async () => (await client()).get<any>("me/drive/root/children") });
  server.tool({ name: "teams", description: "List Teams the user is a member of.", input: z.object({}), handler: async () => (await client()).get<any>("me/joinedTeams") });
}
`);

// ─── Hostinger ────────────────────────────────────────────────────────────
w("hostinger", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const T = process.env.HOSTINGER_API_TOKEN || "";
const api = new ApiClient({ base: "https://developers.hostinger.com/api", rps: 2, defaultHeaders: T ? { Authorization: \`Bearer \${T}\` } : {} });
function need(){ if(!T) throw new Error("HOSTINGER_API_TOKEN required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "domains", description: "List domains.", input: z.object({}), handler: async () => { need(); return api.get<any>("domain/v1/portfolio"); } });
  server.tool({ name: "vps", description: "List VPS instances.", input: z.object({}), handler: async () => { need(); return api.get<any>("vps/v1/virtual-machines"); } });
  server.tool({ name: "billing", description: "List billing.", input: z.object({}), handler: async () => { need(); return api.get<any>("billing/v1/orders"); } });
}
`);

// ─── GoDaddy ──────────────────────────────────────────────────────────────
w("godaddy", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const K = process.env.GODADDY_API_KEY || "";
const S = process.env.GODADDY_API_SECRET || "";
const api = new ApiClient({ base: "https://api.godaddy.com/v1", rps: 2, defaultHeaders: K && S ? { Authorization: \`sso-key \${K}:\${S}\` } : {} });
function need(){ if(!K || !S) throw new Error("GODADDY_API_KEY+SECRET required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "domains", description: "List domains.", input: z.object({}), handler: async () => { need(); return api.get<any>("domains"); } });
  server.tool({ name: "dns", description: "Get DNS records for a domain.", input: z.object({ domain: z.string() }), handler: async ({ domain }) => { need(); return api.get<any>(\`domains/\${domain}/records\`); } });
  server.tool({ name: "orders", description: "List shopper orders.", input: z.object({}), handler: async () => { need(); return api.get<any>("orders"); } });
}
`);

// ─── Our World in Data ────────────────────────────────────────────────────
w("ourworldindata", `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://ourworldindata.org", rps: 2 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "dataset",
    description: "Download a CSV of an OWID chart by slug (returns rows).",
    input: z.object({ slug: z.string(), country: z.string().optional() }),
    handler: async ({ slug, country }) => {
      const csv = await api.get<string>(\`grapher/\${slug}.csv\`, country ? { country } : undefined);
      const lines = String(csv).split("\\n").slice(0, 1000);
      return { slug, rows: lines };
    },
  });
  server.tool({
    name: "chart",
    description: "Get OWID chart metadata JSON.",
    input: z.object({ slug: z.string() }),
    handler: async ({ slug }) => api.get<any>(\`grapher/\${slug}.metadata.json\`),
  });
}
`);

// ─── Chrome / browser MCP (Playwright) ────────────────────────────────────
w("chrome", `import { z, McpServer, Scraper } from "@babagemed/mcp-base";
const scraper = new Scraper({
  base: "about:blank",
  rps: 2,
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  respectRobots: false,
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "browse",
    description: "Open a URL in a real Chromium browser and return rendered HTML + text.",
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      const r = await scraper.fetchHtml(url, { browser: true, cache: false });
      const $ = r.$;
      $("script,style").remove();
      return { url: r.url, status: r.status, title: $("title").text(), text: $("body").text().replace(/\\s+/g, " ").trim().slice(0, 20000) };
    },
  });
  server.tool({
    name: "screenshot",
    description: "Open a URL and return a PNG (base64).",
    input: z.object({ url: z.string().url(), fullPage: z.boolean().optional() }),
    handler: async ({ url, fullPage = false }) => {
      // expose internal context to capture screenshot directly
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        const buf = await page.screenshot({ fullPage });
        return { url, image: buf.toString("base64"), mime: "image/png" };
      } finally { await browser.close(); }
    },
  });
  server.tool({
    name: "extract",
    description: "Extract text matching a CSS selector from a page.",
    input: z.object({ url: z.string().url(), selector: z.string() }),
    handler: async ({ url, selector }) => {
      const r = await scraper.fetchHtml(url, { browser: true });
      const items: string[] = [];
      r.$(selector).each((_, el) => { items.push(r.$(el).text().trim()); });
      return { url, selector, items };
    },
  });
  server.tool({
    name: "click",
    description: "Open a URL, click a selector, return resulting URL+text.",
    input: z.object({ url: z.string().url(), selector: z.string() }),
    handler: async ({ url, selector }) => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.click(selector, { timeout: 10000 });
        await page.waitForLoadState("domcontentloaded");
        return { url: page.url(), text: (await page.textContent("body"))?.slice(0, 5000) ?? "" };
      } finally { await browser.close(); }
    },
  });
}
`);

// ─── Google Scholar (scrape) ──────────────────────────────────────────────
w("googlescholar", `import { z, McpServer, Scraper } from "@babagemed/mcp-base";
const scraper = new Scraper({
  base: "https://scholar.google.com",
  rps: 0.5,
  headless: true,
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  respectRobots: false,
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Google Scholar.",
    input: z.object({ query: z.string().min(1), num: z.number().int().min(1).max(20).optional() }),
    handler: async ({ query, num = 10 }) => {
      const url = \`https://scholar.google.com/scholar?q=\${encodeURIComponent(query)}&num=\${num}\`;
      const r = await scraper.fetchHtml(url, { browser: true });
      const $ = r.$;
      const results: any[] = [];
      $(".gs_r.gs_or").each((_, el) => {
        const a = $(el).find("h3 a").first();
        results.push({
          title: a.text().trim(),
          url: a.attr("href"),
          authors: $(el).find(".gs_a").text().trim(),
          snippet: $(el).find(".gs_rs").text().trim(),
          cites: $(el).find('a:contains("Cited by")').text().trim(),
        });
      });
      return { query, count: results.length, results };
    },
  });
  server.tool({
    name: "author",
    description: "Fetch a Google Scholar profile by user id.",
    input: z.object({ userId: z.string() }),
    handler: async ({ userId }) => {
      const r = await scraper.fetchHtml(\`https://scholar.google.com/citations?user=\${encodeURIComponent(userId)}&hl=en\`, { browser: true });
      const $ = r.$;
      return {
        name: $("#gsc_prf_in").text(),
        affiliation: $(".gsc_prf_il").first().text(),
        citations: $("#gsc_rsb_st td.gsc_rsb_std").first().text(),
      };
    },
  });
  server.tool({
    name: "cite",
    description: "Open a cite-as menu for a search result by cluster id and return BibTeX URL.",
    input: z.object({ clusterId: z.string() }),
    handler: async ({ clusterId }) => {
      const r = await scraper.fetchHtml(\`https://scholar.google.com/scholar?q=info:\${clusterId}:scholar.google.com\`, { browser: true });
      return { url: r.url, text: r.$("body").text().slice(0, 2000) };
    },
  });
}
`);

// ─── Mayo Clinic / Cleveland Clinic / WebMD / Medscape / etc. ─────────────
// These share an enriched scrape pattern: respect robots when allowed, fallback to browser, parse with cheerio.
function richScrape(id, base, querySearch, parsers) {
  const sBase = JSON.stringify(base);
  const sOrigin = JSON.stringify(new URL(base).origin);
  return `import { z, McpServer, Scraper } from "@babagemed/mcp-base";
const scraper = new Scraper({
  base: ${sBase},
  userAgent: process.env.SCRAPER_USER_AGENT,
  rps: Number(process.env.SCRAPER_RATE_RPS || 1),
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS || 30000),
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  cacheTtlSec: Number(process.env.SCRAPER_CACHE_TTL_SEC || 86400),
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  blockMedia: true,
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search ${id}.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = ${JSON.stringify(querySearch)}.replace("{q}", encodeURIComponent(query));
      const r = await scraper.fetchHtml(url, { browser: true });
      const $ = r.$;
      const results: any[] = [];
      ${parsers.searchSelector ? `$(${JSON.stringify(parsers.searchSelector)}).each((_, el) => {
        if (results.length >= limit) return;
        const a = $(el).find("a").first();
        const href = a.attr("href"); if (!href) return;
        try {
          const abs = new URL(href, ${sBase}).toString();
          if (!abs.startsWith(${sOrigin})) return;
          results.push({ title: a.text().trim(), url: abs, snippet: $(el).find(${JSON.stringify(parsers.snippetSelector || "p")}).first().text().trim() });
        } catch {}
      });` : `$("a").each((_, a) => {
        if (results.length >= limit) return;
        const href = $(a).attr("href") || "";
        const text = $(a).text().trim();
        if (!href || text.length < 10) return;
        try {
          const abs = new URL(href, ${sBase}).toString();
          if (!abs.startsWith(${sOrigin})) return;
          if (results.some(r => r.url === abs)) return;
          results.push({ title: text.slice(0, 200), url: abs, snippet: "" });
        } catch {}
      });`}
      return { source: ${JSON.stringify(id)}, query, count: results.length, results };
    },
  });
  server.tool({
    name: "fetch",
    description: "Fetch a ${id} URL and return cleaned text content.",
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      const r = await scraper.fetchHtml(url, { browser: true });
      const $ = r.$;
      $("script,style,nav,footer,header,form,iframe,aside,.ad,.advert,.related").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const sel = ${JSON.stringify(parsers.contentSelector || "main, article, .content, #content, body")};
      const text = $(sel).first().text().replace(/\\s+/g, " ").trim().slice(0, 20000);
      return { url: r.url, status: r.status, title, text };
    },
  });
}
`;
}

// Many sites — write rich-scrape tools.ts using site-specific search URL + content selectors:
const sites = [
  ["mayoclinic",       "https://www.mayoclinic.org", "https://www.mayoclinic.org/search/search-results?q={q}", { searchSelector: ".search-results .result", contentSelector: "main, .content, #main-content" }],
  ["clevelandclinic",  "https://my.clevelandclinic.org", "https://my.clevelandclinic.org/search?q={q}", { searchSelector: ".search__result", contentSelector: "main, .content" }],
  ["rsna",             "https://www.rsna.org", "https://www.rsna.org/search-results?q={q}", { contentSelector: "main, .content-area" }],
  ["radiopaedia",      "https://radiopaedia.org", "https://radiopaedia.org/search?q={q}", { searchSelector: ".search-result", contentSelector: ".body, article, main" }],
  ["medscape",         "https://www.medscape.com", "https://search.medscape.com/search/?q={q}", { searchSelector: ".searchResult", contentSelector: ".article-content, main, article" }],
  ["webmd",            "https://www.webmd.com", "https://www.webmd.com/search/search_results/default.aspx?query={q}", { searchSelector: ".search-results-doc-container", contentSelector: ".article-page, .article, main" }],
  ["merckmanuals",     "https://www.merckmanuals.com", "https://www.merckmanuals.com/professional/SearchResults?query={q}", { searchSelector: ".search-results__item", contentSelector: ".topic, main, article" }],
  ["drugscom",         "https://www.drugs.com", "https://www.drugs.com/search.php?searchterm={q}", { searchSelector: ".ddc-search-result", contentSelector: ".contentBox, .ddc-content, main" }],
  ["rxlist",           "https://www.rxlist.com", "https://www.rxlist.com/search/rxl/{q}", { contentSelector: ".article-content, main" }],
  ["healthline",       "https://www.healthline.com", "https://www.healthline.com/search?q1={q}", { searchSelector: "[data-testid='search-result-item'], li", contentSelector: "article, main" }],
  ["cvphysiology",     "https://www.cvphysiology.com", "https://www.cvphysiology.com/?s={q}", { contentSelector: "main, article" }],
  ["litfl",            "https://litfl.com", "https://litfl.com/?s={q}", { searchSelector: ".search-result, article", contentSelector: "article, main" }],
  ["ninds",            "https://www.ninds.nih.gov", "https://www.ninds.nih.gov/search?keys={q}", { contentSelector: "main, article, .content" }],
  ["niddk",            "https://www.niddk.nih.gov", "https://www.niddk.nih.gov/search?keys={q}", { contentSelector: "main, article, .content" }],
  ["biocodex",         "https://www.biocodexmicrobiotainstitute.com", "https://www.biocodexmicrobiotainstitute.com/en/search?search={q}", { contentSelector: "main, article" }],
  ["nhlbi",            "https://www.nhlbi.nih.gov", "https://www.nhlbi.nih.gov/search/?q={q}", { contentSelector: "main, article" }],
  ["kdigo",            "https://kdigo.org", "https://kdigo.org/?s={q}", { contentSelector: "main, article" }],
  ["kidneyfoundation","https://www.kidney.org", "https://www.kidney.org/search?keywords={q}", { contentSelector: "main, article" }],
  ["renalfellow",     "https://www.renalfellow.org", "https://www.renalfellow.org/?s={q}", { contentSelector: "main, article" }],
  ["healio",          "https://www.healio.com", "https://www.healio.com/search?q={q}", { contentSelector: "main, article" }],
  ["cancerorg",       "https://www.cancer.org", "https://www.cancer.org/search-results.html?q={q}", { contentSelector: "main, article" }],
  ["oncolink",        "https://www.oncolink.org", "https://www.oncolink.org/search?keys={q}", { contentSelector: "main, article" }],
  ["rheumatology",    "https://rheumatology.org", "https://rheumatology.org/search?q={q}", { contentSelector: "main, article" }],
  ["arthritis",       "https://www.arthritis.org", "https://www.arthritis.org/search?q={q}", { contentSelector: "main, article" }],
  ["creakyjoints",    "https://creakyjoints.org", "https://creakyjoints.org/?s={q}", { contentSelector: "main, article" }],
  ["lupus",           "https://www.lupus.org", "https://www.lupus.org/search?keys={q}", { contentSelector: "main, article" }],
  ["spondylitis",     "https://spondylitis.org", "https://spondylitis.org/?s={q}", { contentSelector: "main, article" }],
  ["derangedphys",    "https://derangedphysiology.com", "https://derangedphysiology.com/main/search/node/{q}", { contentSelector: "main, article" }],
  ["thebottomline",   "https://www.thebottomline.org.uk", "https://www.thebottomline.org.uk/?s={q}", { contentSelector: "main, article" }],
  ["nimh",            "https://www.nimh.nih.gov", "https://www.nimh.nih.gov/search?keys={q}", { contentSelector: "main, article" }],
  ["rcpsych",         "https://www.rcpsych.ac.uk", "https://www.rcpsych.ac.uk/search?q={q}", { contentSelector: "main, article" }],
  ["psychiatrictimes","https://www.psychiatrictimes.com", "https://www.psychiatrictimes.com/search?searchTerm={q}", { contentSelector: "main, article" }],
  ["nami",            "https://www.nami.org", "https://www.nami.org/?s={q}", { contentSelector: "main, article" }],
  ["rebelem",         "https://rebelem.com", "https://rebelem.com/?s={q}", { contentSelector: "article, main" }],
  ["first10em",       "https://first10em.com", "https://first10em.com/?s={q}", { contentSelector: "article, main" }],
  ["familydoctor",    "https://familydoctor.org", "https://familydoctor.org/?s={q}", { contentSelector: "main, article" }],
  ["healthdata",      "https://www.healthdata.org", "https://www.healthdata.org/search?keys={q}", { contentSelector: "main, article" }],
  ["pathologyoutlines","https://www.pathologyoutlines.com", "https://www.pathologyoutlines.com/search.html?q={q}", { contentSelector: "body" }],
  ["testingcom",      "https://www.testing.com", "https://www.testing.com/search/?q={q}", { contentSelector: "main, article" }],
  ["dftb",            "https://dontforgetthebubbles.com", "https://dontforgetthebubbles.com/?s={q}", { contentSelector: "article, main" }],
  ["coreem",          "https://coreem.net", "https://coreem.net/?s={q}", { contentSelector: "article, main" }],
  ["iowaprotocols",   "https://webeye.ophth.uiowa.edu", "https://webeye.ophth.uiowa.edu/eyeforum/cases/search.htm?q={q}", { contentSelector: "main, article, body" }],
  ["fpnotebook",      "https://fpnotebook.com", "https://fpnotebook.com/Search.aspx?q={q}", { contentSelector: "main, body" }],
  ["globalfamilydoctor","https://www.globalfamilydoctor.com", "https://www.globalfamilydoctor.com/site/search.aspx?q={q}", { contentSelector: "main, body" }],
  ["gamma",           "https://gamma.app", "https://gamma.app/explore?q={q}", { contentSelector: "main, body" }],
];
for (const [id, base, qs, parsers] of sites) {
  w(id, richScrape(id, base, qs, parsers));
}

console.log("wrote real tools for " + (28 + sites.length) + " MCPs (rest use generic fallback)");

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pubmed",
  name: "PubMed",
  kind: "api",
  category: "literature",
  base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
  port: 6101,
  version: "0.1.0",
});

registerTools(server);
server.run();

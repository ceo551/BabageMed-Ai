import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ncbi",
  name: "NCBI",
  kind: "api",
  category: "literature",
  base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
  port: 6131,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pubchem",
  name: "PubChem",
  kind: "api",
  category: "chemistry",
  base: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
  port: 6128,
  version: "0.1.0",
});

registerTools(server);
server.run();

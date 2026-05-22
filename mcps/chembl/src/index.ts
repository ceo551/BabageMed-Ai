import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "chembl",
  name: "ChEMBL",
  kind: "api",
  category: "chemistry",
  base: "https://www.ebi.ac.uk/chembl/api/data",
  port: 6117,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "spfrance",
  name: "Santé publique France",
  kind: "scrape",
  category: "public-health",
  base: "https://www.santepubliquefrance.fr",
  port: 6312,
  version: "0.1.0",
});

registerTools(server);
server.run();

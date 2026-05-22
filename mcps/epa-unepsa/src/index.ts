import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "epa-unepsa",
  name: "European Paediatric Association / UNEPSA",
  kind: "scrape",
  category: "pediatrics",
  base: "https://www.epa-unepsa.eu",
  port: 6255,
  version: "0.1.0",
});

registerTools(server);
server.run();

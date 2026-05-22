import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "espr",
  name: "European Society for Paediatric Research",
  kind: "scrape",
  category: "pediatrics",
  base: "https://www.espr.eu",
  port: 6254,
  version: "0.1.0",
});

registerTools(server);
server.run();

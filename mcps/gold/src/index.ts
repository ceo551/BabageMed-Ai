import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gold",
  name: "GOLD COPD",
  kind: "scrape",
  category: "pulmonology",
  base: "https://goldcopd.org",
  port: 6342,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "esicm",
  name: "European Society of Intensive Care Medicine",
  kind: "scrape",
  category: "critical-care",
  base: "https://www.esicm.org",
  port: 6301,
  version: "0.1.0",
});

registerTools(server);
server.run();

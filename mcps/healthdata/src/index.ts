import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "healthdata",
  name: "IHME healthdata.org",
  kind: "scrape",
  category: "public-health",
  base: "https://www.healthdata.org",
  port: 6162,
  version: "0.1.0",
});

registerTools(server);
server.run();

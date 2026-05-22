import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "healthgovau",
  name: "Australian Department of Health",
  kind: "scrape",
  category: "public-health",
  base: "https://www.health.gov.au",
  port: 6309,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "phac",
  name: "Public Health Agency of Canada",
  kind: "scrape",
  category: "public-health",
  base: "https://www.canada.ca/en/public-health.html",
  port: 6306,
  version: "0.1.0",
});

registerTools(server);
server.run();

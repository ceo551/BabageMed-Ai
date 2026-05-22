import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wfpha",
  name: "World Federation of Public Health Associations",
  kind: "scrape",
  category: "public-health",
  base: "https://www.wfpha.org",
  port: 6314,
  version: "0.1.0",
});

registerTools(server);
server.run();

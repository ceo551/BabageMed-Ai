import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "apha",
  name: "American Public Health Association",
  kind: "scrape",
  category: "public-health",
  base: "https://www.apha.org",
  port: 6303,
  version: "0.1.0",
});

registerTools(server);
server.run();

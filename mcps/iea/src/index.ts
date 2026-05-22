import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "iea",
  name: "International Epidemiological Association",
  kind: "scrape",
  category: "epidemiology",
  base: "https://ieaweb.org",
  port: 6316,
  version: "0.1.0",
});

registerTools(server);
server.run();

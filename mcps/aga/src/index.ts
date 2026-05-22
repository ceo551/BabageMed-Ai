import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aga",
  name: "American Gastroenterological Association",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://gastro.org",
  port: 6328,
  version: "0.1.0",
});

registerTools(server);
server.run();

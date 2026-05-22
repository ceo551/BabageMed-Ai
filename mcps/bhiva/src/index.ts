import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bhiva",
  name: "British HIV Association",
  kind: "scrape",
  category: "infectious-disease",
  base: "https://www.bhiva.org",
  port: 6393,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "firecrawl",
  name: "FireCrawl",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6710,
  version: "0.1.0",
});

registerTools(server);
server.run();

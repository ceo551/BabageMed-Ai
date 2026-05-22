import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "orphanet",
  name: "Orphanet",
  kind: "scrape",
  category: "genetics",
  base: "https://www.orpha.net",
  port: 6409,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gamma",
  name: "Gamma.app",
  kind: "scrape",
  category: "productivity",
  base: "https://gamma.app",
  port: 6175,
  version: "0.1.0",
});

registerTools(server);
server.run();

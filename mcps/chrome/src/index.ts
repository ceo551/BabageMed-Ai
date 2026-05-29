import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "chrome",
  name: "Chrome (Playwright)",
  kind: "scrape",
  category: "productivity",
  base: "about:blank",
  port: 6177,
  version: "0.1.0",
});

registerTools(server);
server.run();

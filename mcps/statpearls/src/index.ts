import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "statpearls",
  name: "StatPearls",
  kind: "scrape",
  category: "med-ed",
  base: "https://www.statpearls.com",
  port: 6522,
  version: "0.1.0",
});

registerTools(server);
server.run();

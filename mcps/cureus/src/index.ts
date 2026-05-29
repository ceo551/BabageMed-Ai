import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cureus",
  name: "Cureus",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.cureus.com",
  port: 6493,
  version: "0.1.0",
});

registerTools(server);
server.run();

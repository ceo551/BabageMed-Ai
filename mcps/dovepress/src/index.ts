import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dovepress",
  name: "Dove Press",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.dovepress.com",
  port: 6507,
  version: "0.1.0",
});

registerTools(server);
server.run();

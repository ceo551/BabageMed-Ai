import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmjopen",
  name: "BMJ Open",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmjopen.bmj.com",
  port: 6486,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jamanetworkopen",
  name: "JAMA Network Open",
  kind: "scrape",
  category: "oa-journal",
  base: "https://jamanetwork.com/journals/jamanetworkopen",
  port: 6489,
  version: "0.1.0",
});

registerTools(server);
server.run();

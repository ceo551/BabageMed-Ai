import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmjcases",
  name: "BMJ Case Reports",
  kind: "scrape",
  category: "oa-journal",
  base: "https://casereports.bmj.com",
  port: 6487,
  version: "0.1.0",
});

registerTools(server);
server.run();

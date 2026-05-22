import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cms",
  name: "CMS Coverage",
  kind: "api",
  category: "policy",
  base: "https://data.cms.gov",
  port: 6115,
  version: "0.1.0",
});

registerTools(server);
server.run();

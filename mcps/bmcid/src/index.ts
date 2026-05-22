import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmcid",
  name: "BMC Infectious Diseases",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmcinfectdis.biomedcentral.com",
  port: 6480,
  version: "0.1.0",
});

registerTools(server);
server.run();

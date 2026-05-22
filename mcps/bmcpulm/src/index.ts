import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmcpulm",
  name: "BMC Pulmonary Medicine",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmcpulmmed.biomedcentral.com",
  port: 6483,
  version: "0.1.0",
});

registerTools(server);
server.run();

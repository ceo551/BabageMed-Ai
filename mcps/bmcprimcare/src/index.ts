import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmcprimcare",
  name: "BMC Primary Care",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmcprimcare.biomedcentral.com",
  port: 6485,
  version: "0.1.0",
});

registerTools(server);
server.run();

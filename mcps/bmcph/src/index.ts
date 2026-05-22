import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmcph",
  name: "BMC Public Health",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmcpublichealth.biomedcentral.com",
  port: 6479,
  version: "0.1.0",
});

registerTools(server);
server.run();

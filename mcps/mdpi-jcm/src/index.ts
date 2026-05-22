import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mdpi-jcm",
  name: "MDPI Journal of Clinical Medicine",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.mdpi.com/journal/jcm",
  port: 6499,
  version: "0.1.0",
});

registerTools(server);
server.run();

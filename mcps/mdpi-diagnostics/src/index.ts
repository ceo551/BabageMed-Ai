import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mdpi-diagnostics",
  name: "MDPI Diagnostics",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.mdpi.com/journal/diagnostics",
  port: 6501,
  version: "0.1.0",
});

registerTools(server);
server.run();

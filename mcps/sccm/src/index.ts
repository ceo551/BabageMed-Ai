import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sccm",
  name: "Society of Critical Care Medicine",
  kind: "scrape",
  category: "critical-care",
  base: "https://www.sccm.org",
  port: 6298,
  version: "0.1.0",
});

registerTools(server);
server.run();

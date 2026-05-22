import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ficm",
  name: "Faculty of Intensive Care Medicine",
  kind: "scrape",
  category: "critical-care",
  base: "https://www.ficm.ac.uk",
  port: 6300,
  version: "0.1.0",
});

registerTools(server);
server.run();

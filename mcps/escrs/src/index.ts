import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "escrs",
  name: "ESCRS",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://www.escrs.org",
  port: 6357,
  version: "0.1.0",
});

registerTools(server);
server.run();

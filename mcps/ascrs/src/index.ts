import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ascrs",
  name: "ASCRS",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://ascrs.org",
  port: 6358,
  version: "0.1.0",
});

registerTools(server);
server.run();

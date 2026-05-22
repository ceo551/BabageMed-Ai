import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aapos",
  name: "AAPOS",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://www.aapos.org",
  port: 6360,
  version: "0.1.0",
});

registerTools(server);
server.run();

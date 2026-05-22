import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "arvo",
  name: "ARVO",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://www.arvo.org",
  port: 6359,
  version: "0.1.0",
});

registerTools(server);
server.run();

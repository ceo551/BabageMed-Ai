import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aapd",
  name: "American Academy of Pediatric Dentistry",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.aapd.org",
  port: 6426,
  version: "0.1.0",
});

registerTools(server);
server.run();

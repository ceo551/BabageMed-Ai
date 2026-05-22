import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fims",
  name: "FIMS",
  kind: "scrape",
  category: "sports-medicine",
  base: "https://www.fims.org",
  port: 6385,
  version: "0.1.0",
});

registerTools(server);
server.run();

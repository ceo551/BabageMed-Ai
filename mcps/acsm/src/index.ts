import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acsm",
  name: "American College of Sports Medicine",
  kind: "scrape",
  category: "sports-medicine",
  base: "https://www.acsm.org",
  port: 6381,
  version: "0.1.0",
});

registerTools(server);
server.run();

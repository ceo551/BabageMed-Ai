import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bjsm",
  name: "British Journal of Sports Medicine (BMJ)",
  kind: "scrape",
  category: "sports-medicine",
  base: "https://bjsm.bmj.com",
  port: 6383,
  version: "0.1.0",
});

registerTools(server);
server.run();

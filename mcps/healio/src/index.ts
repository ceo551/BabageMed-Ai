import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "healio",
  name: "Healio",
  kind: "scrape",
  category: "news",
  base: "https://www.healio.com",
  port: 6141,
  version: "0.1.0",
});

registerTools(server);
server.run();

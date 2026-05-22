import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "notion",
  name: "Notion",
  kind: "api",
  category: "productivity",
  base: "https://api.notion.com/v1",
  port: 6172,
  version: "0.1.0",
});

registerTools(server);
server.run();

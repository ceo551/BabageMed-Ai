import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gmail",
  name: "Gmail",
  kind: "api",
  category: "productivity",
  base: "https://gmail.googleapis.com/gmail/v1",
  port: 6179,
  version: "0.1.0",
});

registerTools(server);
server.run();

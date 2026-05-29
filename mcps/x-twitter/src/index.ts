import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "x-twitter",
  name: "X (Twitter)",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6565,
  version: "0.1.0",
});

registerTools(server);
server.run();

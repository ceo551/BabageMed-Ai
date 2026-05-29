import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-sheets",
  name: "Google Sheets",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6652,
  version: "0.1.0",
});

registerTools(server);
server.run();

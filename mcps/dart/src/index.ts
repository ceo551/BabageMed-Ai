import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dart",
  name: "Dart",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6658,
  version: "0.1.0",
});

registerTools(server);
server.run();

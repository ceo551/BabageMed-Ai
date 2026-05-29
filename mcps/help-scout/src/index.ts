import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "help-scout",
  name: "Help Scout",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6569,
  version: "0.1.0",
});

registerTools(server);
server.run();

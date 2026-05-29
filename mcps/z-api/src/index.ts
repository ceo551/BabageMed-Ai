import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "z-api",
  name: "Z-API (WhatsApp)",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6567,
  version: "0.1.0",
});

registerTools(server);
server.run();

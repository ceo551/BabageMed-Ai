import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sms-messages",
  name: "SMS Messages (Lleida.net)",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6627,
  version: "0.1.0",
});

registerTools(server);
server.run();

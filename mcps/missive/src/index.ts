import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "missive",
  name: "Missive",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6570,
  version: "0.1.0",
});

registerTools(server);
server.run();

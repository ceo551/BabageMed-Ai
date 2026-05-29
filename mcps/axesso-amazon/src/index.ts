import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "axesso-amazon",
  name: "Axesso Data Service - Amazon",
  kind: "stub",
  category: "data",
  base: "",
  port: 6691,
  version: "0.1.0",
});

registerTools(server);
server.run();

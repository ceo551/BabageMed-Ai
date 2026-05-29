import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "instantly",
  name: "Instantly",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6619,
  version: "0.1.0",
});

registerTools(server);
server.run();

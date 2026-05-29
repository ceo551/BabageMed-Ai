import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "loops-so",
  name: "Loops.so",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6578,
  version: "0.1.0",
});

registerTools(server);
server.run();

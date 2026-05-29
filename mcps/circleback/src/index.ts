import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "circleback",
  name: "Circleback",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6636,
  version: "0.1.0",
});

registerTools(server);
server.run();

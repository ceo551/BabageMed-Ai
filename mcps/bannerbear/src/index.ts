import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bannerbear",
  name: "Bannerbear",
  kind: "stub",
  category: "creative",
  base: "",
  port: 6558,
  version: "0.1.0",
});

registerTools(server);
server.run();

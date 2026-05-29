import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "constant-contact",
  name: "Constant Contact",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6645,
  version: "0.1.0",
});

registerTools(server);
server.run();

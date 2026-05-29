import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rippling",
  name: "Rippling",
  kind: "stub",
  category: "hr",
  base: "",
  port: 6596,
  version: "0.1.0",
});

registerTools(server);
server.run();

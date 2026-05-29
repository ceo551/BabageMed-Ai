import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "linear",
  name: "Linear",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6702,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "tidycal",
  name: "TidyCal",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6672,
  version: "0.1.0",
});

registerTools(server);
server.run();

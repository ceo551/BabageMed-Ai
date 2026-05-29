import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "elastic-email",
  name: "Elastic Email",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6613,
  version: "0.1.0",
});

registerTools(server);
server.run();

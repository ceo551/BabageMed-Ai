import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pipefy",
  name: "Pipefy",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6671,
  version: "0.1.0",
});

registerTools(server);
server.run();

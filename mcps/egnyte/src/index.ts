import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "egnyte",
  name: "Egnyte",
  kind: "stub",
  category: "storage",
  base: "",
  port: 6559,
  version: "0.1.0",
});

registerTools(server);
server.run();

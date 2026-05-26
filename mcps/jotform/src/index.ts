import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jotform",
  name: "Jotform",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6638,
  version: "0.1.0",
});

registerTools(server);
server.run();

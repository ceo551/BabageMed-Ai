import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nango",
  name: "Nango",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6724,
  version: "0.1.0",
});

registerTools(server);
server.run();

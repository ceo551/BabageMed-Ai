import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "lusha",
  name: "Lusha",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6614,
  version: "0.1.0",
});

registerTools(server);
server.run();

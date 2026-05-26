import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "doordash",
  name: "DoorDash",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6696,
  version: "0.1.0",
});

registerTools(server);
server.run();

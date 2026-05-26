import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wati",
  name: "WATI",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6664,
  version: "0.1.0",
});

registerTools(server);
server.run();

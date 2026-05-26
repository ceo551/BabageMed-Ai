import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fibery",
  name: "Fibery",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6646,
  version: "0.1.0",
});

registerTools(server);
server.run();

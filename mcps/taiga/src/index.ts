import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "taiga",
  name: "Taiga",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6641,
  version: "0.1.0",
});

registerTools(server);
server.run();

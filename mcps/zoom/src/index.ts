import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "zoom",
  name: "Zoom",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6575,
  version: "0.1.0",
});

registerTools(server);
server.run();

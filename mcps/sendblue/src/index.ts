import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sendblue",
  name: "Sendblue",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6571,
  version: "0.1.0",
});

registerTools(server);
server.run();

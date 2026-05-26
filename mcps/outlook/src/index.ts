import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "outlook",
  name: "Outlook",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6530,
  version: "0.1.0",
});

registerTools(server);
server.run();

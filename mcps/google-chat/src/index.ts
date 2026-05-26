import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-chat",
  name: "Google Chat",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6751,
  version: "0.1.0",
});

registerTools(server);
server.run();

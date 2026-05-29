import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-tasks",
  name: "Google Tasks",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6542,
  version: "0.1.0",
});

registerTools(server);
server.run();

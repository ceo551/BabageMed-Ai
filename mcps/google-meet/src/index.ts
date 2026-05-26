import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-meet",
  name:     "Google Meet",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6549,
  version:  "0.1.0",
});

registerTools(server);
server.run();

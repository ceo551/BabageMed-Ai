import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "zendesk",
  name:     "Zendesk",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6743,
  version:  "0.1.0",
});

registerTools(server);
server.run();

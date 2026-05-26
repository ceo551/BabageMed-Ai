import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "front",
  name:     "Front",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6628,
  version:  "0.1.0",
});

registerTools(server);
server.run();

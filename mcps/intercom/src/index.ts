import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "intercom",
  name:     "Intercom",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6564,
  version:  "0.1.0",
});

registerTools(server);
server.run();

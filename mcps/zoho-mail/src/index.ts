import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "zoho-mail",
  name:     "Zoho Mail",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6572,
  version:  "0.1.0",
});

registerTools(server);
server.run();

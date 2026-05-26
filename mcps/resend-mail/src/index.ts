import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "resend-mail",
  name:     "Resend Mail",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6744,
  version:  "0.1.0",
});

registerTools(server);
server.run();

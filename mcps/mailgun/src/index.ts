import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "mailgun",
  name:     "Mailgun",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6623,
  version:  "0.1.0",
});

registerTools(server);
server.run();

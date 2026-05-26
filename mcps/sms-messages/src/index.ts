import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "sms-messages",
  name:     "SMS Messages (Lleida.net)",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6627,
  version:  "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "discord-bot",
  name:     "Discord Bot",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6740,
  version:  "0.1.0",
});

registerTools(server);
server.run();

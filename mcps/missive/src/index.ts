import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "missive",
  name:     "Missive",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6570,
  version:  "0.1.0",
});

registerTools(server);
server.run();

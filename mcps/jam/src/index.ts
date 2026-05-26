import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "jam",
  name:     "Jam.dev",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6695,
  version:  "0.1.0",
});

registerTools(server);
server.run();

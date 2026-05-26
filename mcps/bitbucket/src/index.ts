import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "bitbucket",
  name:     "Bitbucket",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6717,
  version:  "0.1.0",
});

registerTools(server);
server.run();

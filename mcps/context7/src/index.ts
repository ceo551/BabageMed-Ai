import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "context7",
  name:     "Context7",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6700,
  version:  "0.1.0",
});

registerTools(server);
server.run();

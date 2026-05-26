import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "expensify",
  name:     "Expensify",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6601,
  version:  "0.1.0",
});

registerTools(server);
server.run();

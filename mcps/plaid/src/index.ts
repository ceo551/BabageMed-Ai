import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "plaid",
  name:     "Plaid",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6734,
  version:  "0.1.0",
});

registerTools(server);
server.run();

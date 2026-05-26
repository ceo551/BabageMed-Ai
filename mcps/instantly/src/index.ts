import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "instantly",
  name:     "Instantly",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6619,
  version:  "0.1.0",
});

registerTools(server);
server.run();

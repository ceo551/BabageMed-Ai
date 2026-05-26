import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "granola",
  name:     "Granola",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6639,
  version:  "0.1.0",
});

registerTools(server);
server.run();

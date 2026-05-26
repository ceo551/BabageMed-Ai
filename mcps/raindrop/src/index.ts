import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "raindrop",
  name:     "Raindrop.io",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6653,
  version:  "0.1.0",
});

registerTools(server);
server.run();

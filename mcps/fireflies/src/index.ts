import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "fireflies",
  name:     "Fireflies.ai",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6637,
  version:  "0.1.0",
});

registerTools(server);
server.run();

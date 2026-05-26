import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "vercel",
  name:     "Vercel",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6536,
  version:  "0.1.0",
});

registerTools(server);
server.run();

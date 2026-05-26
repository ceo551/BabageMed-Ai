import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "cloudflare",
  name:     "Cloudflare",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6712,
  version:  "0.1.0",
});

registerTools(server);
server.run();

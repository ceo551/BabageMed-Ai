import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "wordpress-com",
  name:     "WordPress.com",
  kind:     "api",
  category: "cms",
  base:     "",
  port:     6699,
  version:  "0.1.0",
});

registerTools(server);
server.run();

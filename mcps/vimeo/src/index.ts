import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "vimeo",
  name:     "Vimeo",
  kind:     "api",
  category: "creative",
  base:     "",
  port:     6547,
  version:  "0.1.0",
});

registerTools(server);
server.run();

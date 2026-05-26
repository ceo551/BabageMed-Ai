import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "spotify",
  name:     "Spotify",
  kind:     "api",
  category: "creative",
  base:     "",
  port:     6557,
  version:  "0.1.0",
});

registerTools(server);
server.run();

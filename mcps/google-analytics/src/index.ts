import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-analytics",
  name:     "Google Analytics",
  kind:     "api",
  category: "analytics",
  base:     "",
  port:     6683,
  version:  "0.1.0",
});

registerTools(server);
server.run();

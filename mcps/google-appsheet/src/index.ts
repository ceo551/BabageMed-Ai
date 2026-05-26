import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-appsheet",
  name:     "Google AppSheet",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6647,
  version:  "0.1.0",
});

registerTools(server);
server.run();

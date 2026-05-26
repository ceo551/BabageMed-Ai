import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-cloud",
  name:     "Google Cloud",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6680,
  version:  "0.1.0",
});

registerTools(server);
server.run();

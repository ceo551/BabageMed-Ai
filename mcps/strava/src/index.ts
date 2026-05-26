import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "strava",
  name:     "Strava",
  kind:     "api",
  category: "lifestyle",
  base:     "",
  port:     6550,
  version:  "0.1.0",
});

registerTools(server);
server.run();

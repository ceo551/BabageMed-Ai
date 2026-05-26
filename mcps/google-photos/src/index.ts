import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-photos",
  name:     "Google Photos",
  kind:     "api",
  category: "storage",
  base:     "",
  port:     6560,
  version:  "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "mastodon",
  name:     "Mastodon",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6625,
  version:  "0.1.0",
});

registerTools(server);
server.run();

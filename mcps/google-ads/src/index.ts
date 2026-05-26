import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-ads",
  name:     "Google Ads",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6545,
  version:  "0.1.0",
});

registerTools(server);
server.run();

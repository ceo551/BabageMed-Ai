import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "mixpanel",
  name:     "Mixpanel",
  kind:     "api",
  category: "analytics",
  base:     "",
  port:     6677,
  version:  "0.1.0",
});

registerTools(server);
server.run();

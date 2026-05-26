import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "webflow",
  name:     "Webflow",
  kind:     "api",
  category: "cms",
  base:     "",
  port:     6709,
  version:  "0.1.0",
});

registerTools(server);
server.run();

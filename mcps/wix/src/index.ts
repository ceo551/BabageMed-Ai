import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "wix",
  name:     "Wix",
  kind:     "api",
  category: "cms",
  base:     "",
  port:     6703,
  version:  "0.1.0",
});

registerTools(server);
server.run();

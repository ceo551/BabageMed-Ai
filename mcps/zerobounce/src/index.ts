import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "zerobounce",
  name:     "ZeroBounce",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6714,
  version:  "0.1.0",
});

registerTools(server);
server.run();

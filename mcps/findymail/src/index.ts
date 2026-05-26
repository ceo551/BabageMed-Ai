import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "findymail",
  name:     "Findymail",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6546,
  version:  "0.1.0",
});

registerTools(server);
server.run();

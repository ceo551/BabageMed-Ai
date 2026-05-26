import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "gong",
  name:     "Gong",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6600,
  version:  "0.1.0",
});

registerTools(server);
server.run();

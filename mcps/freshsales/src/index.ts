import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "freshsales",
  name:     "Freshsales",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6630,
  version:  "0.1.0",
});

registerTools(server);
server.run();

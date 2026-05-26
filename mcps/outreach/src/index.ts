import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "outreach",
  name:     "Outreach",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6620,
  version:  "0.1.0",
});

registerTools(server);
server.run();

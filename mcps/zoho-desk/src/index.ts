import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "zoho-desk",
  name:     "Zoho Desk",
  kind:     "api",
  category: "communication",
  base:     "",
  port:     6591,
  version:  "0.1.0",
});

registerTools(server);
server.run();

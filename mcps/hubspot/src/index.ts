import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "hubspot",
  name:     "HubSpot",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6531,
  version:  "0.1.0",
});

registerTools(server);
server.run();

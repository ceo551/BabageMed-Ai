import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "eventbrite",
  name:     "Eventbrite",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6739,
  version:  "0.1.0",
});

registerTools(server);
server.run();

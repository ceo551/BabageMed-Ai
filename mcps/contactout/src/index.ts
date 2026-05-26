import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "contactout",
  name:     "ContactOut",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6612,
  version:  "0.1.0",
});

registerTools(server);
server.run();

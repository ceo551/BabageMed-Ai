import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "basecamp",
  name:     "Basecamp",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6673,
  version:  "0.1.0",
});

registerTools(server);
server.run();

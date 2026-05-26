import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "airtop",
  name:     "Airtop",
  kind:     "api",
  category: "ai",
  base:     "",
  port:     6678,
  version:  "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "teamwork",
  name:     "Teamwork",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6651,
  version:  "0.1.0",
});

registerTools(server);
server.run();

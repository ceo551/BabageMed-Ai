import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "procore",
  name:     "Procore",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6670,
  version:  "0.1.0",
});

registerTools(server);
server.run();

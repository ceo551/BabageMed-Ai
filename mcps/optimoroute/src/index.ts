import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "optimoroute",
  name:     "OptimoRoute",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6605,
  version:  "0.1.0",
});

registerTools(server);
server.run();

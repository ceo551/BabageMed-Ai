import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "drata",
  name:     "Drata",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6585,
  version:  "0.1.0",
});

registerTools(server);
server.run();

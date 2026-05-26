import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "factset",
  name:     "FactSet",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6732,
  version:  "0.1.0",
});

registerTools(server);
server.run();

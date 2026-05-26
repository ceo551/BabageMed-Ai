import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "postgresql",
  name:     "PostgreSQL",
  kind:     "api",
  category: "data",
  base:     "",
  port:     6713,
  version:  "0.1.0",
});

registerTools(server);
server.run();

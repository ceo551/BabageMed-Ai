import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "snowflake",
  name:     "Snowflake",
  kind:     "api",
  category: "data",
  base:     "",
  port:     6533,
  version:  "0.1.0",
});

registerTools(server);
server.run();

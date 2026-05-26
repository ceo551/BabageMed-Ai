import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "ms-sql-server",
  name:     "Microsoft SQL Server",
  kind:     "api",
  category: "data",
  base:     "",
  port:     6708,
  version:  "0.1.0",
});

registerTools(server);
server.run();

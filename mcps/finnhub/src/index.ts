import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "finnhub",
  name:     "Finnhub",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6681,
  version:  "0.1.0",
});

registerTools(server);
server.run();

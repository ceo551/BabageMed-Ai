import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "xero-accounting",
  name:     "Xero Accounting",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6746,
  version:  "0.1.0",
});

registerTools(server);
server.run();

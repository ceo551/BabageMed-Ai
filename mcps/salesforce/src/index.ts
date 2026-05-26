import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "salesforce",
  name:     "Salesforce",
  kind:     "api",
  category: "sales",
  base:     "",
  port:     6617,
  version:  "0.1.0",
});

registerTools(server);
server.run();

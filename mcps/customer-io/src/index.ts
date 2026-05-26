import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "customer-io",
  name:     "Customer.io",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6611,
  version:  "0.1.0",
});

registerTools(server);
server.run();

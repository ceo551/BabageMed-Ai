import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "bigcommerce",
  name:     "BigCommerce",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6747,
  version:  "0.1.0",
});

registerTools(server);
server.run();

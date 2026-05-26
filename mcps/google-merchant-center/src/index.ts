import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-merchant-center",
  name:     "Google Merchant Center",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6749,
  version:  "0.1.0",
});

registerTools(server);
server.run();

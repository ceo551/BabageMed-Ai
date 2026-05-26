import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "drip",
  name:     "Drip",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6607,
  version:  "0.1.0",
});

registerTools(server);
server.run();

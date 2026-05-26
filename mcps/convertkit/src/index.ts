import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "convertkit",
  name:     "ConvertKit",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6618,
  version:  "0.1.0",
});

registerTools(server);
server.run();

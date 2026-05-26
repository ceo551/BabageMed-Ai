import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "harpa-ai",
  name:     "HARPA AI",
  kind:     "api",
  category: "ai",
  base:     "",
  port:     6679,
  version:  "0.1.0",
});

registerTools(server);
server.run();

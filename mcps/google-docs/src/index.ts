import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-docs",
  name:     "Google Docs",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6657,
  version:  "0.1.0",
});

registerTools(server);
server.run();

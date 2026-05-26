import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "highlevel-oauth",
  name:     "HighLevel (OAuth)",
  kind:     "api",
  category: "marketing",
  base:     "",
  port:     6644,
  version:  "0.1.0",
});

registerTools(server);
server.run();

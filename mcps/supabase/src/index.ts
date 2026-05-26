import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "supabase",
  name:     "Supabase",
  kind:     "api",
  category: "developer",
  base:     "",
  port:     6537,
  version:  "0.1.0",
});

registerTools(server);
server.run();

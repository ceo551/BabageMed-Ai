import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "typeform",
  name:     "Typeform",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6643,
  version:  "0.1.0",
});

registerTools(server);
server.run();

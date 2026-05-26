import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "link-ai",
  name:     "Link (CLI)",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6730,
  version:  "0.1.0",
});

registerTools(server);
server.run();

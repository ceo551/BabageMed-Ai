import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "pdf-co",
  name:     "PDF.co",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6561,
  version:  "0.1.0",
});

registerTools(server);
server.run();

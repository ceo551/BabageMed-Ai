import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "docugenerate",
  name:     "DocuGenerate",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6555,
  version:  "0.1.0",
});

registerTools(server);
server.run();

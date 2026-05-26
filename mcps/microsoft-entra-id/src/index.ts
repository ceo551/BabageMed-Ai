import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "microsoft-entra-id",
  name:     "Microsoft Entra ID",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6592,
  version:  "0.1.0",
});

registerTools(server);
server.run();

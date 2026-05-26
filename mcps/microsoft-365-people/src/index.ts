import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "microsoft-365-people",
  name:     "Microsoft 365 People",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6650,
  version:  "0.1.0",
});

registerTools(server);
server.run();

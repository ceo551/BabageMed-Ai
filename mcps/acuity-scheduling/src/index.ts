import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "acuity-scheduling",
  name:     "Acuity Scheduling",
  kind:     "api",
  category: "productivity",
  base:     "",
  port:     6663,
  version:  "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "canva-enterprise",
  name:     "Canva Enterprise",
  kind:     "api",
  category: "creative",
  base:     "",
  port:     6554,
  version:  "0.1.0",
});

registerTools(server);
server.run();

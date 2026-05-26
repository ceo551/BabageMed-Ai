import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "snipe-it",
  name:     "Snipe-IT",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6642,
  version:  "0.1.0",
});

registerTools(server);
server.run();

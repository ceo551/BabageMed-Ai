import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "who",
  name: "WHO",
  kind: "api",
  category: "public-health",
  base: "https://ghoapi.azureedge.net/api",
  port: 6105,
  version: "0.1.0",
});

registerTools(server);
server.run();

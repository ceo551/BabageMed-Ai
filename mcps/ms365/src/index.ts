import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ms365",
  name: "Microsoft 365",
  kind: "api",
  category: "productivity",
  base: "https://graph.microsoft.com/v1.0",
  port: 6186,
  version: "0.1.0",
});

registerTools(server);
server.run();

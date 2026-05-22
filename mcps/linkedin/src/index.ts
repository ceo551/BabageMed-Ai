import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "linkedin",
  name: "LinkedIn",
  kind: "api",
  category: "productivity",
  base: "https://api.linkedin.com/v2",
  port: 6176,
  version: "0.1.0",
});

registerTools(server);
server.run();

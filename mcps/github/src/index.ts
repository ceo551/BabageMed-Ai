import { McpServer } from "@pervagans/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "github",
  name: "GitHub",
  kind: "api",
  category: "productivity",
  base: "https://api.github.com",
  port: 6181,
  version: "0.1.0",
});

registerTools(server);
server.run();

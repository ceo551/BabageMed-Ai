import { McpServer } from "@pervagans/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "facebook-pages",
  name: "Facebook Pages",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6540,
  version: "0.1.0",
});

registerTools(server);
server.run();

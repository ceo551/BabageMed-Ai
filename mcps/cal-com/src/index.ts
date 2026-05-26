import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cal-com",
  name: "Cal.com",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6604,
  version: "0.1.0",
});

registerTools(server);
server.run();

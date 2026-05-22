import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "godaddy",
  name: "GoDaddy",
  kind: "api",
  category: "infra",
  base: "https://api.godaddy.com/v1",
  port: 6185,
  version: "0.1.0",
});

registerTools(server);
server.run();

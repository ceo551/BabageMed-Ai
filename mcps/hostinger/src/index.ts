import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hostinger",
  name: "Hostinger",
  kind: "api",
  category: "infra",
  base: "https://developers.hostinger.com/api",
  port: 6184,
  version: "0.1.0",
});

registerTools(server);
server.run();

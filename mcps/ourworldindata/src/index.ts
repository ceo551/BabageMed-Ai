import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ourworldindata",
  name: "Our World in Data",
  kind: "api",
  category: "public-health",
  base: "https://ourworldindata.org",
  port: 6161,
  version: "0.1.0",
});

registerTools(server);
server.run();

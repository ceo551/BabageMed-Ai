import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ecdc",
  name: "ECDC Europe",
  kind: "scrape",
  category: "public-health",
  base: "https://www.ecdc.europa.eu",
  port: 6305,
  version: "0.1.0",
});

registerTools(server);
server.run();

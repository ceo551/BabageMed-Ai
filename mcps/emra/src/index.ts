import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "emra",
  name: "Emergency Medicine Residents' Association",
  kind: "scrape",
  category: "emergency",
  base: "https://www.emra.org",
  port: 6442,
  version: "0.1.0",
});

registerTools(server);
server.run();

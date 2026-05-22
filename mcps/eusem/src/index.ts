import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eusem",
  name: "European Society for Emergency Medicine",
  kind: "scrape",
  category: "emergency",
  base: "https://eusem.org",
  port: 6441,
  version: "0.1.0",
});

registerTools(server);
server.run();

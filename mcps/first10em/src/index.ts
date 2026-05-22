import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "first10em",
  name: "First10EM",
  kind: "scrape",
  category: "emergency",
  base: "https://first10em.com",
  port: 6158,
  version: "0.1.0",
});

registerTools(server);
server.run();

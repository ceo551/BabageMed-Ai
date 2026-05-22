import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acrm",
  name: "American Congress of Rehabilitation Medicine",
  kind: "scrape",
  category: "pmr",
  base: "https://acrm.org",
  port: 6437,
  version: "0.1.0",
});

registerTools(server);
server.run();

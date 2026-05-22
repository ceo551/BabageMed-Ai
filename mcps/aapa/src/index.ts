import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aapa",
  name: "American Academy of PAs",
  kind: "scrape",
  category: "primary-care",
  base: "https://www.aapa.org",
  port: 6454,
  version: "0.1.0",
});

registerTools(server);
server.run();

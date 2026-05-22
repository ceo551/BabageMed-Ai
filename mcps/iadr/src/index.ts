import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "iadr",
  name: "International Association for Dental Research",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.iadr.org",
  port: 6428,
  version: "0.1.0",
});

registerTools(server);
server.run();

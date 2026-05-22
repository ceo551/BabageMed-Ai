import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ada",
  name: "American Dental Association",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.ada.org",
  port: 6422,
  version: "0.1.0",
});

registerTools(server);
server.run();

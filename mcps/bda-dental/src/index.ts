import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bda-dental",
  name: "British Dental Association",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.bda.org",
  port: 6423,
  version: "0.1.0",
});

registerTools(server);
server.run();

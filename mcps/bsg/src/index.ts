import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bsg",
  name: "British Society of Gastroenterology",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://www.bsg.org.uk",
  port: 6331,
  version: "0.1.0",
});

registerTools(server);
server.run();

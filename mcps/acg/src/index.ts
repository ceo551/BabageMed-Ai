import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acg",
  name: "American College of Gastroenterology",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://gi.org",
  port: 6329,
  version: "0.1.0",
});

registerTools(server);
server.run();

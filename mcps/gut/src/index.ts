import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gut",
  name: "Gut (BMJ)",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://gut.bmj.com",
  port: 6337,
  version: "0.1.0",
});

registerTools(server);
server.run();

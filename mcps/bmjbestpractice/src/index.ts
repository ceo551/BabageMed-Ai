import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmjbestpractice",
  name: "BMJ Best Practice",
  kind: "scrape",
  category: "guidelines",
  base: "https://bestpractice.bmj.com",
  port: 6488,
  version: "0.1.0",
});

registerTools(server);
server.run();

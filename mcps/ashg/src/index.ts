import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ashg",
  name: "American Society of Human Genetics",
  kind: "scrape",
  category: "genetics",
  base: "https://www.ashg.org",
  port: 6411,
  version: "0.1.0",
});

registerTools(server);
server.run();

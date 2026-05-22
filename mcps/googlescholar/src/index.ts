import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "googlescholar",
  name: "Google Scholar",
  kind: "scrape",
  category: "literature",
  base: "https://scholar.google.com",
  port: 6178,
  version: "0.1.0",
});

registerTools(server);
server.run();

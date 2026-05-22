import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ats",
  name: "American Thoracic Society",
  kind: "scrape",
  category: "pulmonology",
  base: "https://www.thoracic.org",
  port: 6338,
  version: "0.1.0",
});

registerTools(server);
server.run();

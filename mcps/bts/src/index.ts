import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bts",
  name: "British Thoracic Society",
  kind: "scrape",
  category: "pulmonology",
  base: "https://www.brit-thoracic.org.uk",
  port: 6341,
  version: "0.1.0",
});

registerTools(server);
server.run();

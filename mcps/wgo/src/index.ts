import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wgo",
  name: "World Gastroenterology Organisation",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://www.worldgastroenterology.org",
  port: 6336,
  version: "0.1.0",
});

registerTools(server);
server.run();

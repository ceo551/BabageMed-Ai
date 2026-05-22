import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rpharms",
  name: "Royal Pharmaceutical Society",
  kind: "scrape",
  category: "pharmacology",
  base: "https://www.rpharms.com",
  port: 6279,
  version: "0.1.0",
});

registerTools(server);
server.run();

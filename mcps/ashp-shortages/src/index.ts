import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ashp-shortages",
  name: "ASHP Drug Shortages",
  kind: "scrape",
  category: "pharmacology",
  base: "https://www.ashp.org/drug-shortages",
  port: 6277,
  version: "0.1.0",
});

registerTools(server);
server.run();

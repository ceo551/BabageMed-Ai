import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bnfc",
  name: "British National Formulary for Children",
  kind: "scrape",
  category: "pharmacology",
  base: "https://bnfc.nice.org.uk",
  port: 6268,
  version: "0.1.0",
});

registerTools(server);
server.run();

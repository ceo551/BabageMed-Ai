import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "healthcanada-drugs",
  name: "Health Canada drug database",
  kind: "scrape",
  category: "pharmacology",
  base: "https://health-products.canada.ca/dpd-bdpp/",
  port: 6274,
  version: "0.1.0",
});

registerTools(server);
server.run();

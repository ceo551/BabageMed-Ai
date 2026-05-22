import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "tga",
  name: "Therapeutic Goods Administration (Australia)",
  kind: "scrape",
  category: "drug-regulation",
  base: "https://www.tga.gov.au",
  port: 6272,
  version: "0.1.0",
});

registerTools(server);
server.run();

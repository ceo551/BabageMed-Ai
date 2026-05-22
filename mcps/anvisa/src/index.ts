import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "anvisa",
  name: "ANVISA Brazil",
  kind: "scrape",
  category: "drug-regulation",
  base: "https://www.gov.br/anvisa",
  port: 6276,
  version: "0.1.0",
});

registerTools(server);
server.run();

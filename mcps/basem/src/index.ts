import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "basem",
  name: "BASEM",
  kind: "scrape",
  category: "sports-medicine",
  base: "https://www.basem.co.uk",
  port: 6384,
  version: "0.1.0",
});

registerTools(server);
server.run();

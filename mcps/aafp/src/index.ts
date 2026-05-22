import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aafp",
  name: "American Academy of Family Physicians",
  kind: "scrape",
  category: "family-medicine",
  base: "https://www.aafp.org",
  port: 6451,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asn-nutrition",
  name: "American Society for Nutrition",
  kind: "scrape",
  category: "nutrition",
  base: "https://nutrition.org",
  port: 6432,
  version: "0.1.0",
});

registerTools(server);
server.run();

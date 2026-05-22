import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aspen-nutrition",
  name: "ASPEN",
  kind: "scrape",
  category: "nutrition",
  base: "https://www.nutritioncare.org",
  port: 6434,
  version: "0.1.0",
});

registerTools(server);
server.run();

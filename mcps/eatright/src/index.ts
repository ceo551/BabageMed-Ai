import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eatright",
  name: "Academy of Nutrition and Dietetics",
  kind: "scrape",
  category: "nutrition",
  base: "https://www.eatright.org",
  port: 6430,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "oup-aje",
  name: "American Journal of Epidemiology",
  kind: "scrape",
  category: "epidemiology",
  base: "https://academic.oup.com/aje",
  port: 6317,
  version: "0.1.0",
});

registerTools(server);
server.run();

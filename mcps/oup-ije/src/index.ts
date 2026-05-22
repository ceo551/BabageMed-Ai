import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "oup-ije",
  name: "International Journal of Epidemiology",
  kind: "scrape",
  category: "epidemiology",
  base: "https://academic.oup.com/ije",
  port: 6318,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nature-bjc",
  name: "British Journal of Cancer (Nature)",
  kind: "scrape",
  category: "oncology",
  base: "https://www.nature.com/bjc/",
  port: 6235,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aace",
  name: "American Association of Clinical Endocrinology",
  kind: "scrape",
  category: "endocrinology",
  base: "https://www.aace.com",
  port: 6322,
  version: "0.1.0",
});

registerTools(server);
server.run();

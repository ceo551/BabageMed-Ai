import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "elife",
  name: "eLife",
  kind: "scrape",
  category: "oa-journal",
  base: "https://elifesciences.org",
  port: 6492,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aapmr",
  name: "American Academy of Physical Medicine & Rehabilitation",
  kind: "scrape",
  category: "pmr",
  base: "https://www.aapmr.org",
  port: 6435,
  version: "0.1.0",
});

registerTools(server);
server.run();

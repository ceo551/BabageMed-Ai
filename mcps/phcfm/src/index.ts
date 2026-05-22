import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "phcfm",
  name: "African Journal of Primary Health Care & Family Medicine",
  kind: "scrape",
  category: "oa-journal",
  base: "https://phcfm.org",
  port: 6510,
  version: "0.1.0",
});

registerTools(server);
server.run();

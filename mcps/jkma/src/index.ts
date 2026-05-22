import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jkma",
  name: "Korean Medical Association Journal",
  kind: "scrape",
  category: "oa-journal",
  base: "https://jkma.org",
  port: 6516,
  version: "0.1.0",
});

registerTools(server);
server.run();

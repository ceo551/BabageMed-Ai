import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jmir",
  name: "JMIR",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.jmir.org",
  port: 6495,
  version: "0.1.0",
});

registerTools(server);
server.run();

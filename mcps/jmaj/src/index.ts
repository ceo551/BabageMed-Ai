import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jmaj",
  name: "JMA Journal (Japan)",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.jmaj.jp",
  port: 6513,
  version: "0.1.0",
});

registerTools(server);
server.run();

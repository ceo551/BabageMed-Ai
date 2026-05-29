import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ramb",
  name: "Revista da AMB",
  kind: "scrape",
  category: "oa-journal",
  base: "https://ramb.amb.org.br",
  port: 6519,
  version: "0.1.0",
});

registerTools(server);
server.run();

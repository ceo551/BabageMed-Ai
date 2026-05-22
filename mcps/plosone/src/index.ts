import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "plosone",
  name: "PLOS ONE",
  kind: "scrape",
  category: "oa-journal",
  base: "https://journals.plos.org/plosone",
  port: 6473,
  version: "0.1.0",
});

registerTools(server);
server.run();

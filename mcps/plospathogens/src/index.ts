import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "plospathogens",
  name: "PLOS Pathogens",
  kind: "scrape",
  category: "oa-journal",
  base: "https://journals.plos.org/plospathogens",
  port: 6476,
  version: "0.1.0",
});

registerTools(server);
server.run();

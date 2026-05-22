import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "plosntds",
  name: "PLOS Neglected Tropical Diseases",
  kind: "scrape",
  category: "oa-journal",
  base: "https://journals.plos.org/plosntds",
  port: 6475,
  version: "0.1.0",
});

registerTools(server);
server.run();

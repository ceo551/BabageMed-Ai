import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "plosgph",
  name: "PLOS Global Public Health",
  kind: "scrape",
  category: "oa-journal",
  base: "https://journals.plos.org/globalpublichealth",
  port: 6477,
  version: "0.1.0",
});

registerTools(server);
server.run();

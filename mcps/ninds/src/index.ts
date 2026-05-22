import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ninds",
  name: "NINDS",
  kind: "scrape",
  category: "neurology",
  base: "https://www.ninds.nih.gov",
  port: 6133,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ashpub",
  name: "ASH Publications",
  kind: "scrape",
  category: "hematology",
  base: "https://ashpublications.org",
  port: 6387,
  version: "0.1.0",
});

registerTools(server);
server.run();

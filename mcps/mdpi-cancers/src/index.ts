import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mdpi-cancers",
  name: "MDPI Cancers",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.mdpi.com/journal/cancers",
  port: 6500,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mdpi-antibiotics",
  name: "MDPI Antibiotics",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.mdpi.com/journal/antibiotics",
  port: 6503,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mdpi-nutrients",
  name: "MDPI Nutrients",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.mdpi.com/journal/nutrients",
  port: 6502,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "stfm",
  name: "Society of Teachers of Family Medicine",
  kind: "scrape",
  category: "family-medicine",
  base: "https://stfm.org",
  port: 6453,
  version: "0.1.0",
});

registerTools(server);
server.run();

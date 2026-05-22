import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wiley-bb",
  name: "Wiley Brain and Behavior",
  kind: "scrape",
  category: "oa-journal",
  base: "https://onlinelibrary.wiley.com/journal/21623279",
  port: 6505,
  version: "0.1.0",
});

registerTools(server);
server.run();

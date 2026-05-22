import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "f1000",
  name: "F1000Research",
  kind: "scrape",
  category: "oa-journal",
  base: "https://f1000research.com",
  port: 6494,
  version: "0.1.0",
});

registerTools(server);
server.run();

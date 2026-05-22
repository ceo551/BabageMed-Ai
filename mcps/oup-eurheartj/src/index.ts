import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "oup-eurheartj",
  name: "European Heart Journal (Oxford)",
  kind: "scrape",
  category: "cardiology",
  base: "https://academic.oup.com/eurheartj",
  port: 6205,
  version: "0.1.0",
});

registerTools(server);
server.run();

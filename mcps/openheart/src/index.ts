import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "openheart",
  name: "Open Heart (BMJ OA)",
  kind: "scrape",
  category: "cardiology",
  base: "https://openheart.bmj.com",
  port: 6215,
  version: "0.1.0",
});

registerTools(server);
server.run();

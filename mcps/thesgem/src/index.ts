import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "thesgem",
  name: "The Skeptics' Guide to EM",
  kind: "scrape",
  category: "emergency",
  base: "https://www.thesgem.com",
  port: 6448,
  version: "0.1.0",
});

registerTools(server);
server.run();

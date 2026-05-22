import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "canadiem",
  name: "CanadiEM",
  kind: "scrape",
  category: "emergency",
  base: "https://canadiem.org",
  port: 6449,
  version: "0.1.0",
});

registerTools(server);
server.run();

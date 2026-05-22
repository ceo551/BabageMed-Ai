import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rebelem",
  name: "REBEL EM",
  kind: "scrape",
  category: "emergency",
  base: "https://rebelem.com",
  port: 6157,
  version: "0.1.0",
});

registerTools(server);
server.run();

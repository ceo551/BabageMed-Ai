import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aliem",
  name: "ALiEM",
  kind: "scrape",
  category: "emergency",
  base: "https://www.aliem.com",
  port: 6444,
  version: "0.1.0",
});

registerTools(server);
server.run();

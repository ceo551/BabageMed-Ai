import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "litfl",
  name: "LITFL",
  kind: "scrape",
  category: "emergency",
  base: "https://litfl.com",
  port: 6132,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mouthhealthy",
  name: "MouthHealthy",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.mouthhealthy.org",
  port: 6429,
  version: "0.1.0",
});

registerTools(server);
server.run();

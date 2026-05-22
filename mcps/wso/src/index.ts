import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wso",
  name: "World Stroke Organization",
  kind: "scrape",
  category: "neurology",
  base: "https://www.world-stroke.org",
  port: 6239,
  version: "0.1.0",
});

registerTools(server);
server.run();

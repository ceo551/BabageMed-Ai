import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "publichealthontario",
  name: "Public Health Ontario",
  kind: "scrape",
  category: "public-health",
  base: "https://www.publichealthontario.ca",
  port: 6308,
  version: "0.1.0",
});

registerTools(server);
server.run();

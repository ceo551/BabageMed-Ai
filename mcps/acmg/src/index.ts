import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acmg",
  name: "American College of Medical Genetics",
  kind: "scrape",
  category: "genetics",
  base: "https://www.acmg.net",
  port: 6407,
  version: "0.1.0",
});

registerTools(server);
server.run();

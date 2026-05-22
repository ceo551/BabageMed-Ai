import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asge",
  name: "American Society for GI Endoscopy",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://www.asge.org",
  port: 6330,
  version: "0.1.0",
});

registerTools(server);
server.run();

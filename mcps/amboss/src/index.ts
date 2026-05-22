import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "amboss",
  name: "AMBOSS",
  kind: "scrape",
  category: "med-ed",
  base: "https://www.amboss.com/us/knowledge",
  port: 6523,
  version: "0.1.0",
});

registerTools(server);
server.run();

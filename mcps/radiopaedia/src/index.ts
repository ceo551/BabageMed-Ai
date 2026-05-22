import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "radiopaedia",
  name: "Radiopaedia",
  kind: "scrape",
  category: "radiology",
  base: "https://radiopaedia.org",
  port: 6110,
  version: "0.1.0",
});

registerTools(server);
server.run();

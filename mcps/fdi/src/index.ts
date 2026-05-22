import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fdi",
  name: "FDI World Dental Federation",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.fdiworlddental.org",
  port: 6424,
  version: "0.1.0",
});

registerTools(server);
server.run();

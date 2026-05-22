import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jamanetwork",
  name: "JAMA Network",
  kind: "scrape",
  category: "journal",
  base: "https://jamanetwork.com",
  port: 6490,
  version: "0.1.0",
});

registerTools(server);
server.run();

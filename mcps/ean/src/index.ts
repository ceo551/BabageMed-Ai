import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ean",
  name: "European Academy of Neurology",
  kind: "scrape",
  category: "neurology",
  base: "https://www.ean.org",
  port: 6237,
  version: "0.1.0",
});

registerTools(server);
server.run();

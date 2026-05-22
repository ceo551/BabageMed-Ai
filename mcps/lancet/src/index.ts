import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "lancet",
  name: "The Lancet",
  kind: "scrape",
  category: "journal",
  base: "https://www.thelancet.com",
  port: 6491,
  version: "0.1.0",
});

registerTools(server);
server.run();

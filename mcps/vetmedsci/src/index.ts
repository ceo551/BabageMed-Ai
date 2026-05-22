import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "vetmedsci",
  name: "Veterinary Medicine and Science",
  kind: "scrape",
  category: "veterinary",
  base: "https://onlinelibrary.wiley.com/journal/20531095",
  port: 6472,
  version: "0.1.0",
});

registerTools(server);
server.run();

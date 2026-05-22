import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "lupus",
  name: "Lupus.org",
  kind: "scrape",
  category: "rheumatology",
  base: "https://www.lupus.org",
  port: 6148,
  version: "0.1.0",
});

registerTools(server);
server.run();

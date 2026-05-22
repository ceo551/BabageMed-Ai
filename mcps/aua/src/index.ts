import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aua",
  name: "American Urological Association",
  kind: "scrape",
  category: "urology",
  base: "https://www.auanet.org",
  port: 6368,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eau",
  name: "European Association of Urology",
  kind: "scrape",
  category: "urology",
  base: "https://uroweb.org",
  port: 6370,
  version: "0.1.0",
});

registerTools(server);
server.run();

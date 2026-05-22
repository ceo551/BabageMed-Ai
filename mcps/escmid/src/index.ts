import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "escmid",
  name: "ESCMID",
  kind: "scrape",
  category: "infectious-disease",
  base: "https://www.escmid.org",
  port: 6392,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "urologyhealth",
  name: "Urology Care Foundation",
  kind: "scrape",
  category: "urology",
  base: "https://www.urologyhealth.org",
  port: 6369,
  version: "0.1.0",
});

registerTools(server);
server.run();

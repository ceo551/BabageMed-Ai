import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jmir-publichealth",
  name: "JMIR Public Health & Surveillance",
  kind: "scrape",
  category: "oa-journal",
  base: "https://publichealth.jmir.org",
  port: 6496,
  version: "0.1.0",
});

registerTools(server);
server.run();

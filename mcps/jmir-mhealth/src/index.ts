import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jmir-mhealth",
  name: "JMIR mHealth & uHealth",
  kind: "scrape",
  category: "oa-journal",
  base: "https://mhealth.jmir.org",
  port: 6498,
  version: "0.1.0",
});

registerTools(server);
server.run();

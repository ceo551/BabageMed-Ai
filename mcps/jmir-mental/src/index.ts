import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jmir-mental",
  name: "JMIR Mental Health",
  kind: "scrape",
  category: "oa-journal",
  base: "https://mental.jmir.org",
  port: 6497,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "smjsg",
  name: "Singapore Medical Journal",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.smj.org.sg",
  port: 6515,
  version: "0.1.0",
});

registerTools(server);
server.run();

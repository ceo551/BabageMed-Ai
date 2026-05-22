import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bsrm",
  name: "British Society of Rehabilitation Medicine",
  kind: "scrape",
  category: "pmr",
  base: "https://www.bsrm.org.uk",
  port: 6438,
  version: "0.1.0",
});

registerTools(server);
server.run();

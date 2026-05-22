import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cks",
  name: "NICE Clinical Knowledge Summaries (CKS)",
  kind: "scrape",
  category: "primary-care",
  base: "https://cks.nice.org.uk",
  port: 6270,
  version: "0.1.0",
});

registerTools(server);
server.run();

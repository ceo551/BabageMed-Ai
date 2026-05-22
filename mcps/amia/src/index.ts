import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "amia",
  name: "American Medical Informatics Association",
  kind: "scrape",
  category: "informatics",
  base: "https://www.amia.org",
  port: 6530,
  version: "0.1.0",
});

registerTools(server);
server.run();

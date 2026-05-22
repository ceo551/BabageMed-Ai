import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "amssm",
  name: "American Medical Society for Sports Medicine",
  kind: "scrape",
  category: "sports-medicine",
  base: "https://www.amssm.org",
  port: 6382,
  version: "0.1.0",
});

registerTools(server);
server.run();

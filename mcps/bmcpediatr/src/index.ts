import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmcpediatr",
  name: "BMC Pediatrics",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmcpediatr.biomedcentral.com",
  port: 6481,
  version: "0.1.0",
});

registerTools(server);
server.run();

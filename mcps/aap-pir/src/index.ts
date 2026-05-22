import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aap-pir",
  name: "Pediatrics in Review (AAP)",
  kind: "scrape",
  category: "pediatrics",
  base: "https://publications.aap.org/pediatricsinreview",
  port: 6256,
  version: "0.1.0",
});

registerTools(server);
server.run();

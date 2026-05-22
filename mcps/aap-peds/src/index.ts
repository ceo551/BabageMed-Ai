import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aap-peds",
  name: "American Academy of Pediatrics",
  kind: "scrape",
  category: "pediatrics",
  base: "https://www.aap.org",
  port: 6250,
  version: "0.1.0",
});

registerTools(server);
server.run();

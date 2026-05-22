import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eaaci",
  name: "EAACI",
  kind: "scrape",
  category: "allergy",
  base: "https://www.eaaci.org",
  port: 6398,
  version: "0.1.0",
});

registerTools(server);
server.run();

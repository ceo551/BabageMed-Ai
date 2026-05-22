import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "openanesthesia",
  name: "OpenAnesthesia",
  kind: "scrape",
  category: "anesthesia",
  base: "https://www.openanesthesia.org",
  port: 6296,
  version: "0.1.0",
});

registerTools(server);
server.run();

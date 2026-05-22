import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "socca",
  name: "Society of Critical Care Anesthesiologists",
  kind: "scrape",
  category: "critical-care",
  base: "https://www.socca.org",
  port: 6299,
  version: "0.1.0",
});

registerTools(server);
server.run();

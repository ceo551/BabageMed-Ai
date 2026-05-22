import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "baus",
  name: "British Association of Urological Surgeons",
  kind: "scrape",
  category: "urology",
  base: "https://www.baus.org.uk",
  port: 6371,
  version: "0.1.0",
});

registerTools(server);
server.run();

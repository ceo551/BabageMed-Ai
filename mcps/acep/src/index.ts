import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acep",
  name: "American College of Emergency Physicians",
  kind: "scrape",
  category: "emergency",
  base: "https://www.acep.org",
  port: 6439,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcem",
  name: "Royal College of Emergency Medicine",
  kind: "scrape",
  category: "emergency",
  base: "https://rcem.ac.uk",
  port: 6440,
  version: "0.1.0",
});

registerTools(server);
server.run();

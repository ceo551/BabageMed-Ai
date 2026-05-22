import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "chest",
  name: "American College of Chest Physicians",
  kind: "scrape",
  category: "pulmonology",
  base: "https://www.chestnet.org",
  port: 6339,
  version: "0.1.0",
});

registerTools(server);
server.run();

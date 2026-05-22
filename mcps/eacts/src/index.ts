import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eacts",
  name: "European Association for Cardio-Thoracic Surgery",
  kind: "scrape",
  category: "cardiothoracic",
  base: "https://www.eacts.org",
  port: 6219,
  version: "0.1.0",
});

registerTools(server);
server.run();

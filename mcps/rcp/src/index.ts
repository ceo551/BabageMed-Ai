import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcp",
  name: "Royal College of Physicians (London)",
  kind: "scrape",
  category: "internal-medicine",
  base: "https://www.rcp.ac.uk",
  port: 6455,
  version: "0.1.0",
});

registerTools(server);
server.run();

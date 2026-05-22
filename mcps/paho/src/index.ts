import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "paho",
  name: "Pan American Health Organization",
  kind: "scrape",
  category: "public-health",
  base: "https://www.paho.org",
  port: 6307,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aofas",
  name: "American Orthopaedic Foot & Ankle Society",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.aofas.org",
  port: 6375,
  version: "0.1.0",
});

registerTools(server);
server.run();

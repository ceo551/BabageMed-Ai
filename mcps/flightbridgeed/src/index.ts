import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "flightbridgeed",
  name: "FlightBridgeED",
  kind: "scrape",
  category: "emergency",
  base: "https://www.flightbridgeed.com",
  port: 6450,
  version: "0.1.0",
});

registerTools(server);
server.run();

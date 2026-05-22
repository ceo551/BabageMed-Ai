import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aaos",
  name: "American Academy of Orthopaedic Surgeons",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.aaos.org",
  port: 6372,
  version: "0.1.0",
});

registerTools(server);
server.run();

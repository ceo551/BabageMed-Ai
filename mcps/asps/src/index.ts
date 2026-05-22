import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asps",
  name: "American Society of Plastic Surgeons",
  kind: "scrape",
  category: "plastic-surgery",
  base: "https://www.plasticsurgery.org",
  port: 6289,
  version: "0.1.0",
});

registerTools(server);
server.run();

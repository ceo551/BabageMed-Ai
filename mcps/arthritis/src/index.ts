import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "arthritis",
  name: "Arthritis.org",
  kind: "scrape",
  category: "rheumatology",
  base: "https://www.arthritis.org",
  port: 6146,
  version: "0.1.0",
});

registerTools(server);
server.run();

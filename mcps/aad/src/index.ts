import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aad",
  name: "American Academy of Dermatology",
  kind: "scrape",
  category: "dermatology",
  base: "https://www.aad.org",
  port: 6345,
  version: "0.1.0",
});

registerTools(server);
server.run();

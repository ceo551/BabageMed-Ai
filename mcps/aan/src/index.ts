import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aan",
  name: "American Academy of Neurology",
  kind: "scrape",
  category: "neurology",
  base: "https://www.aan.com",
  port: 6236,
  version: "0.1.0",
});

registerTools(server);
server.run();

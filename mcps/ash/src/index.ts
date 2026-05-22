import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ash",
  name: "American Society of Hematology",
  kind: "scrape",
  category: "hematology",
  base: "https://www.hematology.org",
  port: 6386,
  version: "0.1.0",
});

registerTools(server);
server.run();

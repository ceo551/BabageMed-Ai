import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "erj-openres",
  name: "ERJ Open Research",
  kind: "scrape",
  category: "pulmonology",
  base: "https://openres.ersjournals.com",
  port: 6344,
  version: "0.1.0",
});

registerTools(server);
server.run();

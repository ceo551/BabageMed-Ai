import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gina",
  name: "GINA Asthma",
  kind: "scrape",
  category: "pulmonology",
  base: "https://ginasthma.org",
  port: 6343,
  version: "0.1.0",
});

registerTools(server);
server.run();

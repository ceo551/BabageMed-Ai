import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wao",
  name: "World Allergy Organization",
  kind: "scrape",
  category: "allergy",
  base: "https://www.worldallergy.org",
  port: 6400,
  version: "0.1.0",
});

registerTools(server);
server.run();

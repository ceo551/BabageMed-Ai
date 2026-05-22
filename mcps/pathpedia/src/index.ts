import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pathpedia",
  name: "PathPedia",
  kind: "scrape",
  category: "pathology",
  base: "https://www.pathpedia.com",
  port: 6406,
  version: "0.1.0",
});

registerTools(server);
server.run();

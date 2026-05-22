import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bsh",
  name: "British Society for Haematology",
  kind: "scrape",
  category: "hematology",
  base: "https://b-s-h.org.uk",
  port: 6389,
  version: "0.1.0",
});

registerTools(server);
server.run();

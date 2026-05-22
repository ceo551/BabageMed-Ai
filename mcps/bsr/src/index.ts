import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bsr",
  name: "British Society for Rheumatology",
  kind: "scrape",
  category: "rheumatology",
  base: "https://www.rheumatology.org.uk",
  port: 6464,
  version: "0.1.0",
});

registerTools(server);
server.run();

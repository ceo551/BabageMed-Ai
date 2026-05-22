import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "spondylitis",
  name: "Spondylitis.org",
  kind: "scrape",
  category: "rheumatology",
  base: "https://spondylitis.org",
  port: 6149,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rheumatology",
  name: "ACR Rheumatology",
  kind: "scrape",
  category: "rheumatology",
  base: "https://rheumatology.org",
  port: 6144,
  version: "0.1.0",
});

registerTools(server);
server.run();

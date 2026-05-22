import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pathologyoutlines",
  name: "PathologyOutlines",
  kind: "scrape",
  category: "pathology",
  base: "https://www.pathologyoutlines.com",
  port: 6163,
  version: "0.1.0",
});

registerTools(server);
server.run();

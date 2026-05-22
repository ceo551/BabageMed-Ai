import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aacr",
  name: "American Association for Cancer Research",
  kind: "scrape",
  category: "oncology",
  base: "https://www.aacr.org",
  port: 6226,
  version: "0.1.0",
});

registerTools(server);
server.run();

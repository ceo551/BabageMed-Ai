import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "coreem",
  name: "Core EM",
  kind: "scrape",
  category: "emergency",
  base: "https://coreem.net",
  port: 6166,
  version: "0.1.0",
});

registerTools(server);
server.run();

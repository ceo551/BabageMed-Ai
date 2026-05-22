import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nami",
  name: "NAMI",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.nami.org",
  port: 6155,
  version: "0.1.0",
});

registerTools(server);
server.run();

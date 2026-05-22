import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "euraps",
  name: "EURAPS",
  kind: "scrape",
  category: "plastic-surgery",
  base: "https://www.euraps.org",
  port: 6291,
  version: "0.1.0",
});

registerTools(server);
server.run();

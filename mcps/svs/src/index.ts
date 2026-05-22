import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "svs",
  name: "Society for Vascular Surgery",
  kind: "scrape",
  category: "vascular-surgery",
  base: "https://vascular.org",
  port: 6216,
  version: "0.1.0",
});

registerTools(server);
server.run();

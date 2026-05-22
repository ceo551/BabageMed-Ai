import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "espen",
  name: "ESPEN",
  kind: "scrape",
  category: "nutrition",
  base: "https://www.espen.org",
  port: 6433,
  version: "0.1.0",
});

registerTools(server);
server.run();

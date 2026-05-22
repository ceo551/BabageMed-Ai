import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "medscape",
  name: "Medscape",
  kind: "scrape",
  category: "clinical-ref",
  base: "https://www.medscape.com",
  port: 6111,
  version: "0.1.0",
});

registerTools(server);
server.run();

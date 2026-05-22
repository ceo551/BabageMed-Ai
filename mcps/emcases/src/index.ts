import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "emcases",
  name: "Emergency Medicine Cases",
  kind: "scrape",
  category: "emergency",
  base: "https://emergencymedicinecases.com",
  port: 6447,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cvphysiology",
  name: "CV Physiology",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.cvphysiology.com",
  port: 6130,
  version: "0.1.0",
});

registerTools(server);
server.run();

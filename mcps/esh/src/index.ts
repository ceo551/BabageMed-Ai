import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "esh",
  name: "European Society of Hypertension",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.eshonline.org",
  port: 6209,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acr-rad",
  name: "American College of Radiology",
  kind: "scrape",
  category: "radiology",
  base: "https://www.acr.org",
  port: 6258,
  version: "0.1.0",
});

registerTools(server);
server.run();

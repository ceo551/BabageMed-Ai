import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eurosurveillance",
  name: "Eurosurveillance",
  kind: "scrape",
  category: "epidemiology",
  base: "https://www.eurosurveillance.org",
  port: 6319,
  version: "0.1.0",
});

registerTools(server);
server.run();

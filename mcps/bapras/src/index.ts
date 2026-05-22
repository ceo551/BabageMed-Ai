import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bapras",
  name: "BAPRAS",
  kind: "scrape",
  category: "plastic-surgery",
  base: "https://www.bapras.org.uk",
  port: 6292,
  version: "0.1.0",
});

registerTools(server);
server.run();

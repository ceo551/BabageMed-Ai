import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nice",
  name: "NICE (UK guidelines)",
  kind: "scrape",
  category: "guidelines",
  base: "https://www.nice.org.uk",
  port: 6269,
  version: "0.1.0",
});

registerTools(server);
server.run();

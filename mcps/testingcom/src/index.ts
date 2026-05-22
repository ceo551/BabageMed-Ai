import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "testingcom",
  name: "Testing.com",
  kind: "scrape",
  category: "lab",
  base: "https://www.testing.com",
  port: 6164,
  version: "0.1.0",
});

registerTools(server);
server.run();

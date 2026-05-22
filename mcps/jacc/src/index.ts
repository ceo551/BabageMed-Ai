import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jacc",
  name: "JACC Journals",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.jacc.org",
  port: 6203,
  version: "0.1.0",
});

registerTools(server);
server.run();

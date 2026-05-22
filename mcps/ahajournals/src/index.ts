import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ahajournals",
  name: "American Heart Association Journals",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.ahajournals.org",
  port: 6202,
  version: "0.1.0",
});

registerTools(server);
server.run();

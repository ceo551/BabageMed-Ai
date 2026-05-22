import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "britishrenal",
  name: "British Renal Society",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.britishrenal.org",
  port: 6462,
  version: "0.1.0",
});

registerTools(server);
server.run();

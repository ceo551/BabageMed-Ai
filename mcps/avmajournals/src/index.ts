import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "avmajournals",
  name: "AVMA Journals",
  kind: "scrape",
  category: "veterinary",
  base: "https://avmajournals.avma.org",
  port: 6467,
  version: "0.1.0",
});

registerTools(server);
server.run();

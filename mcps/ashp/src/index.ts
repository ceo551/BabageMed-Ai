import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ashp",
  name: "American Society of Health-System Pharmacists",
  kind: "scrape",
  category: "pharmacology",
  base: "https://www.ashp.org",
  port: 6278,
  version: "0.1.0",
});

registerTools(server);
server.run();

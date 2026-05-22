import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "kidneyfoundation",
  name: "National Kidney Fdn.",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.kidney.org",
  port: 6139,
  version: "0.1.0",
});

registerTools(server);
server.run();

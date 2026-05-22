import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "racs",
  name: "Royal Australasian College of Surgeons",
  kind: "scrape",
  category: "surgery",
  base: "https://www.surgeons.org",
  port: 6285,
  version: "0.1.0",
});

registerTools(server);
server.run();

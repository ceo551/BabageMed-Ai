import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "avma",
  name: "American Veterinary Medical Association",
  kind: "scrape",
  category: "veterinary",
  base: "https://www.avma.org",
  port: 6466,
  version: "0.1.0",
});

registerTools(server);
server.run();

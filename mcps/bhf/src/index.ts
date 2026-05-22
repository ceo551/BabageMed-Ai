import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bhf",
  name: "British Heart Foundation",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.bhf.org.uk",
  port: 6214,
  version: "0.1.0",
});

registerTools(server);
server.run();

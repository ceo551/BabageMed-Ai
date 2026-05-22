import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "emdocs",
  name: "EMDocs",
  kind: "scrape",
  category: "emergency",
  base: "https://www.emdocs.net",
  port: 6445,
  version: "0.1.0",
});

registerTools(server);
server.run();

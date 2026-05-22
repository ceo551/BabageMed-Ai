import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bcs",
  name: "British Cardiovascular Society",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.britishcardiovascularsociety.org",
  port: 6213,
  version: "0.1.0",
});

registerTools(server);
server.run();

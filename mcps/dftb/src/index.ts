import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dftb",
  name: "Don't Forget the Bubbles",
  kind: "scrape",
  category: "pediatrics",
  base: "https://dontforgetthebubbles.com",
  port: 6165,
  version: "0.1.0",
});

registerTools(server);
server.run();

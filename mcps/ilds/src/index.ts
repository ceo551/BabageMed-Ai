import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ilds",
  name: "International League of Dermatological Societies",
  kind: "scrape",
  category: "dermatology",
  base: "https://www.ilds.org",
  port: 6349,
  version: "0.1.0",
});

registerTools(server);
server.run();

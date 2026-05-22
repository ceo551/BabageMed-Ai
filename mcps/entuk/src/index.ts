import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "entuk",
  name: "ENT UK",
  kind: "scrape",
  category: "ent",
  base: "https://www.entuk.org",
  port: 6352,
  version: "0.1.0",
});

registerTools(server);
server.run();

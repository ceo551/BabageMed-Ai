import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ceorl",
  name: "CEORL-HNS",
  kind: "scrape",
  category: "ent",
  base: "https://www.ceorlhns.org",
  port: 6353,
  version: "0.1.0",
});

registerTools(server);
server.run();

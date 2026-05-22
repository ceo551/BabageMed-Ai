import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "amb-br",
  name: "Brazilian Medical Association",
  kind: "scrape",
  category: "society",
  base: "https://amb.org.br",
  port: 6518,
  version: "0.1.0",
});

registerTools(server);
server.run();

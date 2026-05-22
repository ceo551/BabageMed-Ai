import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "genomeweb",
  name: "GenomeWeb",
  kind: "scrape",
  category: "genetics",
  base: "https://www.genomeweb.com",
  port: 6412,
  version: "0.1.0",
});

registerTools(server);
server.run();

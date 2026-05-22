import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eshre",
  name: "ESHRE",
  kind: "scrape",
  category: "obgyn",
  base: "https://www.eshre.eu",
  port: 6367,
  version: "0.1.0",
});

registerTools(server);
server.run();

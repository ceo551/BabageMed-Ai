import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "isprm",
  name: "ISPRM",
  kind: "scrape",
  category: "pmr",
  base: "https://www.isprm.org",
  port: 6436,
  version: "0.1.0",
});

registerTools(server);
server.run();

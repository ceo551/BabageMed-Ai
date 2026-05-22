import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "smfm",
  name: "Society for Maternal-Fetal Medicine",
  kind: "scrape",
  category: "obgyn",
  base: "https://www.smfm.org",
  port: 6365,
  version: "0.1.0",
});

registerTools(server);
server.run();

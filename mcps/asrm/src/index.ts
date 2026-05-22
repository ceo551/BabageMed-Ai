import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asrm",
  name: "American Society for Reproductive Medicine",
  kind: "scrape",
  category: "obgyn",
  base: "https://www.asrm.org",
  port: 6366,
  version: "0.1.0",
});

registerTools(server);
server.run();

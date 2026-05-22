import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "figo",
  name: "FIGO",
  kind: "scrape",
  category: "obgyn",
  base: "https://www.figo.org",
  port: 6364,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fsmb",
  name: "Federation of State Medical Boards",
  kind: "scrape",
  category: "regulation",
  base: "https://www.fsmb.org",
  port: 6529,
  version: "0.1.0",
});

registerTools(server);
server.run();

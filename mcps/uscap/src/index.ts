import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "uscap",
  name: "USCAP",
  kind: "scrape",
  category: "pathology",
  base: "https://www.uscap.org",
  port: 6404,
  version: "0.1.0",
});

registerTools(server);
server.run();

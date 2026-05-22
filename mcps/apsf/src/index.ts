import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "apsf",
  name: "Anesthesia Patient Safety Foundation",
  kind: "scrape",
  category: "anesthesia",
  base: "https://www.apsf.org",
  port: 6297,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "idsa",
  name: "Infectious Diseases Society of America",
  kind: "scrape",
  category: "infectious-disease",
  base: "https://www.idsociety.org",
  port: 6391,
  version: "0.1.0",
});

registerTools(server);
server.run();

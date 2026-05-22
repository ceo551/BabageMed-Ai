import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ilae",
  name: "International League Against Epilepsy",
  kind: "scrape",
  category: "neurology",
  base: "https://www.ilae.org",
  port: 6242,
  version: "0.1.0",
});

registerTools(server);
server.run();

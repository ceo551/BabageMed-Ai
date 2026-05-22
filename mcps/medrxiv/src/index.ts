import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "medrxiv",
  name: "medRxiv",
  kind: "api",
  category: "preprints",
  base: "https://api.biorxiv.org",
  port: 6118,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "biorxiv",
  name: "bioRxiv",
  kind: "api",
  category: "preprints",
  base: "https://api.biorxiv.org",
  port: 6119,
  version: "0.1.0",
});

registerTools(server);
server.run();

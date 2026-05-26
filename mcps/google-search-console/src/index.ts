import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-search-console",
  name: "Google Search Console",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6689,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-slides",
  name: "Google Slides",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6667,
  version: "0.1.0",
});

registerTools(server);
server.run();

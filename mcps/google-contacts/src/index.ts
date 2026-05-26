import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-contacts",
  name: "Google Contacts",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6750,
  version: "0.1.0",
});

registerTools(server);
server.run();

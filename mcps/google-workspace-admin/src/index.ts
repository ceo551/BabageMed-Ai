import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-workspace-admin",
  name: "Google Workspace Admin",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6589,
  version: "0.1.0",
});

registerTools(server);
server.run();

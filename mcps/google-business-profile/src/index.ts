import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-business-profile",
  name: "Google Business Profile",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6593,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-tag-manager",
  name: "Google Tag Manager",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6548,
  version: "0.1.0",
});

registerTools(server);
server.run();

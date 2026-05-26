import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cloudflare-browser",
  name: "Cloudflare Browser Rendering",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6704,
  version: "0.1.0",
});

registerTools(server);
server.run();

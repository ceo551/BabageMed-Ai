import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wikem",
  name: "WikEM",
  kind: "api",
  category: "emergency",
  base: "https://wikem.org/w/api.php",
  port: 6156,
  version: "0.1.0",
});

registerTools(server);
server.run();

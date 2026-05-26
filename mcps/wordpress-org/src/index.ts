import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wordpress-org",
  name: "WordPress.org",
  kind: "stub",
  category: "cms",
  base: "",
  port: 6629,
  version: "0.1.0",
});

registerTools(server);
server.run();

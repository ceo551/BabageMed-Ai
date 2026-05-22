import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eyewiki",
  name: "EyeWiki",
  kind: "api",
  category: "ophthalmology",
  base: "https://eyewiki.org/w/api.php",
  port: 6168,
  version: "0.1.0",
});

registerTools(server);
server.run();

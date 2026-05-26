import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "youtube-analytics",
  name: "YouTube Analytics",
  kind: "stub",
  category: "creative",
  base: "",
  port: 6539,
  version: "0.1.0",
});

registerTools(server);
server.run();

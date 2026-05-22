import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "slack",
  name: "Slack",
  kind: "api",
  category: "productivity",
  base: "https://slack.com/api",
  port: 6173,
  version: "0.1.0",
});

registerTools(server);
server.run();

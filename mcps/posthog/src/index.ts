import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "posthog",
  name:     "PostHog",
  kind:     "api",
  category: "analytics",
  base:     "",
  port:     6692,
  version:  "0.1.0",
});

registerTools(server);
server.run();

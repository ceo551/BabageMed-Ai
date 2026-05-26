import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "atlassian",
  name:     "Atlassian (Jira/Confluence)",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6580,
  version:  "0.1.0",
});

registerTools(server);
server.run();

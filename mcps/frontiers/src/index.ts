import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "frontiers",
  name: "Frontiers",
  kind: "hybrid",
  category: "journals",
  base: "https://www.frontiersin.org",
  port: 6160,
  version: "0.1.0",
});

registerTools(server);
server.run();

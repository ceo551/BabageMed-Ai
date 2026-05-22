import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nejm",
  name: "NEJM",
  kind: "hybrid",
  category: "journals",
  base: "https://www.nejm.org",
  port: 6126,
  version: "0.1.0",
});

registerTools(server);
server.run();

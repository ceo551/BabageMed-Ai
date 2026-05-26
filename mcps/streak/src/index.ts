import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "streak",
  name: "Streak",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6635,
  version: "0.1.0",
});

registerTools(server);
server.run();

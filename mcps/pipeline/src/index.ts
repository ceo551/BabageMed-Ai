import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pipeline",
  name: "Pipeline",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6615,
  version: "0.1.0",
});

registerTools(server);
server.run();

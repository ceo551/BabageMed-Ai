import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cb-insights",
  name: "CB Insights",
  kind: "stub",
  category: "research",
  base: "",
  port: 6737,
  version: "0.1.0",
});

registerTools(server);
server.run();

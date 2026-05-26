import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "midpage",
  name: "Midpage",
  kind: "stub",
  category: "research",
  base: "",
  port: 6736,
  version: "0.1.0",
});

registerTools(server);
server.run();

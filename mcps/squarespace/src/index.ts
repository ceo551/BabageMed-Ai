import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "squarespace",
  name: "Squarespace",
  kind: "stub",
  category: "cms",
  base: "",
  port: 6705,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "coda",
  name: "Coda",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6640,
  version: "0.1.0",
});

registerTools(server);
server.run();

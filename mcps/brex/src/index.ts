import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "brex",
  name: "Brex",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6587,
  version: "0.1.0",
});

registerTools(server);
server.run();

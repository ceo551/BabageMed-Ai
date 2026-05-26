import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ashby",
  name: "Ashby",
  kind: "stub",
  category: "hr",
  base: "",
  port: 6603,
  version: "0.1.0",
});

registerTools(server);
server.run();

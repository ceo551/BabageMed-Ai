import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ramp",
  name: "Ramp",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6733,
  version: "0.1.0",
});

registerTools(server);
server.run();

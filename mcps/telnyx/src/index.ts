import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "telnyx",
  name: "Telnyx",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6706,
  version: "0.1.0",
});

registerTools(server);
server.run();

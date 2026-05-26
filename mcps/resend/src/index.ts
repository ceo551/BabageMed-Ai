import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "resend",
  name: "Resend",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6726,
  version: "0.1.0",
});

registerTools(server);
server.run();

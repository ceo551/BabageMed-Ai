import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "resend-mail",
  name: "Resend Mail",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6744,
  version: "0.1.0",
});

registerTools(server);
server.run();

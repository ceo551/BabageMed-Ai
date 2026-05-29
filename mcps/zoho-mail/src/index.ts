import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "zoho-mail",
  name: "Zoho Mail",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6572,
  version: "0.1.0",
});

registerTools(server);
server.run();

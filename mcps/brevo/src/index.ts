import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "brevo",
  name: "Brevo",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6632,
  version: "0.1.0",
});

registerTools(server);
server.run();

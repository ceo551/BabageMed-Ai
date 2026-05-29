import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "typeform",
  name: "Typeform",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6643,
  version: "0.1.0",
});

registerTools(server);
server.run();

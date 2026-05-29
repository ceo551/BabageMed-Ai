import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "carta",
  name: "Carta",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6583,
  version: "0.1.0",
});

registerTools(server);
server.run();

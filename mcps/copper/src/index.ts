import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "copper",
  name: "Copper",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6610,
  version: "0.1.0",
});

registerTools(server);
server.run();

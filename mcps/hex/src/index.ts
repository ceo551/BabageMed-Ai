import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hex",
  name: "Hex",
  kind: "stub",
  category: "data",
  base: "",
  port: 6684,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "unleashed-software",
  name: "Unleashed Software",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6602,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "freshservice",
  name: "Freshservice",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6668,
  version: "0.1.0",
});

registerTools(server);
server.run();

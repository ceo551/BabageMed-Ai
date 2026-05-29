import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "attio",
  name: "Attio",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6626,
  version: "0.1.0",
});

registerTools(server);
server.run();

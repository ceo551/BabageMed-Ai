import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "motion",
  name: "Motion",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6661,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "carbon-arc",
  name: "Carbon Arc",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6729,
  version: "0.1.0",
});

registerTools(server);
server.run();

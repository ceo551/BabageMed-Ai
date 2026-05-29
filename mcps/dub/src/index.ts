import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dub",
  name: "Dub",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6648,
  version: "0.1.0",
});

registerTools(server);
server.run();

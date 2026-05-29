import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "clerk",
  name: "Clerk",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6728,
  version: "0.1.0",
});

registerTools(server);
server.run();

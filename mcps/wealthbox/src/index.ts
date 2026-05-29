import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wealthbox",
  name: "Wealthbox",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6616,
  version: "0.1.0",
});

registerTools(server);
server.run();

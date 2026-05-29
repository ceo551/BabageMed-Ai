import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "freshdesk",
  name: "Freshdesk",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6576,
  version: "0.1.0",
});

registerTools(server);
server.run();

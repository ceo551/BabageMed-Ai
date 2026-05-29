import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hubspot",
  name: "HubSpot",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6531,
  version: "0.1.0",
});

registerTools(server);
server.run();

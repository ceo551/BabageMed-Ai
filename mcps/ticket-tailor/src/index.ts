import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ticket-tailor",
  name: "Ticket Tailor",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6581,
  version: "0.1.0",
});

registerTools(server);
server.run();

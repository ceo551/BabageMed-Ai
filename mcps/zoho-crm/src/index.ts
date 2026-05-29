import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "zoho-crm",
  name: "Zoho CRM",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6631,
  version: "0.1.0",
});

registerTools(server);
server.run();

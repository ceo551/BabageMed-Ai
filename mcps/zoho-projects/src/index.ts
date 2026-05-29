import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "zoho-projects",
  name: "Zoho Projects",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6674,
  version: "0.1.0",
});

registerTools(server);
server.run();

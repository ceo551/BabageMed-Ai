import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "docusign",
  name: "Docusign",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6544,
  version: "0.1.0",
});

registerTools(server);
server.run();

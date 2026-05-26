import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "shopify",
  name: "Shopify",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6582,
  version: "0.1.0",
});

registerTools(server);
server.run();

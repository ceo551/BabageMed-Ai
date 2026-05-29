import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cdc",
  name: "CDC",
  kind: "api",
  category: "public-health",
  base: "https://data.cdc.gov/resource",
  port: 6106,
  version: "0.1.0",
});

registerTools(server);
server.run();

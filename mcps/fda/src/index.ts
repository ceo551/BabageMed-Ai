import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fda",
  name: "FDA",
  kind: "api",
  category: "drugs",
  base: "https://api.fda.gov",
  port: 6136,
  version: "0.1.0",
});

registerTools(server);
server.run();

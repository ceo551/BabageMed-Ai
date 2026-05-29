import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cochrane",
  name: "Cochrane",
  kind: "hybrid",
  category: "evidence",
  base: "https://www.cochranelibrary.com",
  port: 6113,
  version: "0.1.0",
});

registerTools(server);
server.run();

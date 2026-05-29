import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "roam-research",
  name: "Roam Research",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6669,
  version: "0.1.0",
});

registerTools(server);
server.run();

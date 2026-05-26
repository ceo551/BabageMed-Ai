import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "trello",
  name: "Trello",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6676,
  version: "0.1.0",
});

registerTools(server);
server.run();

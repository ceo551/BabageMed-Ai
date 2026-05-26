import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pipedrive",
  name: "Pipedrive",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6633,
  version: "0.1.0",
});

registerTools(server);
server.run();

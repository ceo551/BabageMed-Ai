import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "replicate",
  name: "Replicate",
  kind: "stub",
  category: "ai",
  base: "",
  port: 6721,
  version: "0.1.0",
});

registerTools(server);
server.run();

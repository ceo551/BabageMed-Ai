import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "airweave",
  name: "Airweave",
  kind: "stub",
  category: "ai",
  base: "",
  port: 6688,
  version: "0.1.0",
});

registerTools(server);
server.run();

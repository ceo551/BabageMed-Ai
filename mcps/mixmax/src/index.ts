import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mixmax",
  name: "MixMax",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6577,
  version: "0.1.0",
});

registerTools(server);
server.run();

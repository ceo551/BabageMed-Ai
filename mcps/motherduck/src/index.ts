import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "motherduck",
  name: "MotherDuck",
  kind: "stub",
  category: "data",
  base: "",
  port: 6535,
  version: "0.1.0",
});

registerTools(server);
server.run();

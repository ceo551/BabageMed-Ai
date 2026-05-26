import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "toggl-track",
  name: "Toggl Track",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6599,
  version: "0.1.0",
});

registerTools(server);
server.run();

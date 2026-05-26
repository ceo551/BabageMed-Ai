import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "twitch",
  name: "Twitch",
  kind: "stub",
  category: "creative",
  base: "",
  port: 6541,
  version: "0.1.0",
});

registerTools(server);
server.run();

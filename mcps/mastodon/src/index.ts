import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mastodon",
  name: "Mastodon",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6625,
  version: "0.1.0",
});

registerTools(server);
server.run();

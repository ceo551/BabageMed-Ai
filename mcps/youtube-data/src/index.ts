import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "youtube-data",
  name: "YouTube Data",
  kind: "stub",
  category: "creative",
  base: "",
  port: 6563,
  version: "0.1.0",
});

registerTools(server);
server.run();

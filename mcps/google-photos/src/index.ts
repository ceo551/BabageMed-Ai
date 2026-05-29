import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-photos",
  name: "Google Photos",
  kind: "stub",
  category: "storage",
  base: "",
  port: 6560,
  version: "0.1.0",
});

registerTools(server);
server.run();

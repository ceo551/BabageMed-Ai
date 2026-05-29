import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "deepgram",
  name: "Deepgram",
  kind: "stub",
  category: "ai",
  base: "",
  port: 6687,
  version: "0.1.0",
});

registerTools(server);
server.run();

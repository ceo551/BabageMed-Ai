import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aweber",
  name: "AWeber",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6624,
  version: "0.1.0",
});

registerTools(server);
server.run();

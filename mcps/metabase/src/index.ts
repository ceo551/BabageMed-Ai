import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "metabase",
  name: "Metabase",
  kind: "stub",
  category: "analytics",
  base: "",
  port: 6685,
  version: "0.1.0",
});

registerTools(server);
server.run();

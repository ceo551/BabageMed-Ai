import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sanity",
  name: "Sanity",
  kind: "stub",
  category: "cms",
  base: "",
  port: 6716,
  version: "0.1.0",
});

registerTools(server);
server.run();

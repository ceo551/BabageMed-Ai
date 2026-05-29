import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmj",
  name: "The BMJ",
  kind: "hybrid",
  category: "journals",
  base: "https://www.bmj.com",
  port: 6127,
  version: "0.1.0",
});

registerTools(server);
server.run();

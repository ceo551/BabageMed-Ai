import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "perplexity-finance",
  name: "Perplexity Finance",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6735,
  version: "0.1.0",
});

registerTools(server);
server.run();

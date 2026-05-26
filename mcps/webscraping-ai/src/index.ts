import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "webscraping-ai",
  name: "WebScraping.AI",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6752,
  version: "0.1.0",
});

registerTools(server);
server.run();

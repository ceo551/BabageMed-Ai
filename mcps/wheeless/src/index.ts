import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wheeless",
  name: "Wheeless' Textbook of Orthopaedics",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.wheelessonline.com",
  port: 6524,
  version: "0.1.0",
});

registerTools(server);
server.run();

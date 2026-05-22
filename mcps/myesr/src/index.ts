import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "myesr",
  name: "European Society of Radiology",
  kind: "scrape",
  category: "radiology",
  base: "https://www.myesr.org",
  port: 6259,
  version: "0.1.0",
});

registerTools(server);
server.run();

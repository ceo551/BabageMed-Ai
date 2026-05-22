import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acog",
  name: "American College of OB/GYN",
  kind: "scrape",
  category: "obgyn",
  base: "https://www.acog.org",
  port: 6362,
  version: "0.1.0",
});

registerTools(server);
server.run();

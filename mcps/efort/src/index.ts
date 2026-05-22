import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "efort",
  name: "EFORT",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.efort.org",
  port: 6379,
  version: "0.1.0",
});

registerTools(server);
server.run();

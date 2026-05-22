import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "espghan",
  name: "ESPGHAN",
  kind: "scrape",
  category: "pediatric-gi",
  base: "https://www.espghan.org",
  port: 6335,
  version: "0.1.0",
});

registerTools(server);
server.run();

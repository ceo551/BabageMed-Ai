import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "escardio",
  name: "European Society of Cardiology",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.escardio.org",
  port: 6204,
  version: "0.1.0",
});

registerTools(server);
server.run();

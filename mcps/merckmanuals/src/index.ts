import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "merckmanuals",
  name: "Merck Manuals",
  kind: "scrape",
  category: "clinical-ref",
  base: "https://www.merckmanuals.com",
  port: 6114,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fpnotebook",
  name: "FPNotebook",
  kind: "scrape",
  category: "primary-care",
  base: "https://fpnotebook.com",
  port: 6170,
  version: "0.1.0",
});

registerTools(server);
server.run();

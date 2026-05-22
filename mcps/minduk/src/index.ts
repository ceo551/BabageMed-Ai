import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "minduk",
  name: "Mind UK",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.mind.org.uk",
  port: 6248,
  version: "0.1.0",
});

registerTools(server);
server.run();

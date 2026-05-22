import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ninjanerd",
  name: "Ninja Nerd",
  kind: "scrape",
  category: "med-ed",
  base: "https://ninjanerd.org",
  port: 6525,
  version: "0.1.0",
});

registerTools(server);
server.run();

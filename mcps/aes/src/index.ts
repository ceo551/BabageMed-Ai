import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aes",
  name: "American Epilepsy Society",
  kind: "scrape",
  category: "neurology",
  base: "https://aesnet.org",
  port: 6241,
  version: "0.1.0",
});

registerTools(server);
server.run();

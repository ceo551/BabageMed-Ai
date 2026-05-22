import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eshg",
  name: "European Society of Human Genetics",
  kind: "scrape",
  category: "genetics",
  base: "https://www.eshg.org",
  port: 6410,
  version: "0.1.0",
});

registerTools(server);
server.run();

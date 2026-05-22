import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sts",
  name: "Society of Thoracic Surgeons",
  kind: "scrape",
  category: "cardiothoracic",
  base: "https://www.sts.org",
  port: 6218,
  version: "0.1.0",
});

registerTools(server);
server.run();

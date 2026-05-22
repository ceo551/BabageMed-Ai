import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "iagg",
  name: "IAGG",
  kind: "scrape",
  category: "geriatrics",
  base: "https://www.iagg.info",
  port: 6416,
  version: "0.1.0",
});

registerTools(server);
server.run();

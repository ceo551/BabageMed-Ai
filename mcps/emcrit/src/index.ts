import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "emcrit",
  name: "EMCrit",
  kind: "scrape",
  category: "emergency",
  base: "https://emcrit.org",
  port: 6443,
  version: "0.1.0",
});

registerTools(server);
server.run();

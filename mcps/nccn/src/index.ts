import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nccn",
  name: "NCCN",
  kind: "scrape",
  category: "oncology",
  base: "https://www.nccn.org",
  port: 6234,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "samj",
  name: "South African Medical Journal",
  kind: "scrape",
  category: "oa-journal",
  base: "https://samj.org.za",
  port: 6511,
  version: "0.1.0",
});

registerTools(server);
server.run();

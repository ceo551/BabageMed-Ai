import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aosis",
  name: "AOSIS (African journals)",
  kind: "scrape",
  category: "oa-journal",
  base: "https://journals.aosis.co.za",
  port: 6509,
  version: "0.1.0",
});

registerTools(server);
server.run();

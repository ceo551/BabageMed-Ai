import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hivgov",
  name: "HIV.gov",
  kind: "scrape",
  category: "infectious-disease",
  base: "https://www.hiv.gov",
  port: 6395,
  version: "0.1.0",
});

registerTools(server);
server.run();

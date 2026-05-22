import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "omim",
  name: "OMIM",
  kind: "scrape",
  category: "genetics",
  base: "https://www.omim.org",
  port: 6408,
  version: "0.1.0",
});

registerTools(server);
server.run();

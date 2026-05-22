import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "idf",
  name: "International Diabetes Federation",
  kind: "scrape",
  category: "endocrinology",
  base: "https://idf.org",
  port: 6325,
  version: "0.1.0",
});

registerTools(server);
server.run();

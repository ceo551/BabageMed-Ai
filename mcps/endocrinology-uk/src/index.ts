import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "endocrinology-uk",
  name: "Society for Endocrinology (UK)",
  kind: "scrape",
  category: "endocrinology",
  base: "https://www.endocrinology.org",
  port: 6327,
  version: "0.1.0",
});

registerTools(server);
server.run();

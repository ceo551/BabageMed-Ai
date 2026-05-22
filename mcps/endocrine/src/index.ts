import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "endocrine",
  name: "Endocrine Society",
  kind: "scrape",
  category: "endocrinology",
  base: "https://www.endocrine.org",
  port: 6320,
  version: "0.1.0",
});

registerTools(server);
server.run();

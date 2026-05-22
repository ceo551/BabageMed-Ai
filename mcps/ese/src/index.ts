import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ese",
  name: "European Society of Endocrinology",
  kind: "scrape",
  category: "endocrinology",
  base: "https://www.ese-hormones.org",
  port: 6323,
  version: "0.1.0",
});

registerTools(server);
server.run();

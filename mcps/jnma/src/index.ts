import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "jnma",
  name: "Journal of Nepal Medical Association",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.jnma.com.np",
  port: 6514,
  version: "0.1.0",
});

registerTools(server);
server.run();

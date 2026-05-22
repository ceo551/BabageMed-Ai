import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmccancer",
  name: "BMC Cancer",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmccancer.biomedcentral.com",
  port: 6482,
  version: "0.1.0",
});

registerTools(server);
server.run();

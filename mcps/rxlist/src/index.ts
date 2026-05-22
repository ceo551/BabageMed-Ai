import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rxlist",
  name: "RxList",
  kind: "scrape",
  category: "drugs",
  base: "https://www.rxlist.com",
  port: 6123,
  version: "0.1.0",
});

registerTools(server);
server.run();

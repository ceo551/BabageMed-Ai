import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "webmd",
  name: "WebMD",
  kind: "scrape",
  category: "patient-ref",
  base: "https://www.webmd.com",
  port: 6112,
  version: "0.1.0",
});

registerTools(server);
server.run();

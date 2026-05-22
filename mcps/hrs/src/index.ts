import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hrs",
  name: "Heart Rhythm Society",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.hrsonline.org",
  port: 6206,
  version: "0.1.0",
});

registerTools(server);
server.run();

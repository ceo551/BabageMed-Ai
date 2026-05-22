import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "globalfamilydoctor",
  name: "WONCA",
  kind: "scrape",
  category: "primary-care",
  base: "https://www.globalfamilydoctor.com",
  port: 6171,
  version: "0.1.0",
});

registerTools(server);
server.run();

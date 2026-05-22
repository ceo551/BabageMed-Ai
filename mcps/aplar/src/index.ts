import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aplar",
  name: "APLAR",
  kind: "scrape",
  category: "rheumatology",
  base: "https://aplar.org",
  port: 6465,
  version: "0.1.0",
});

registerTools(server);
server.run();

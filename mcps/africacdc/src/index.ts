import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "africacdc",
  name: "Africa CDC",
  kind: "scrape",
  category: "public-health",
  base: "https://africacdc.org",
  port: 6313,
  version: "0.1.0",
});

registerTools(server);
server.run();

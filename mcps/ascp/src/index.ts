import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ascp",
  name: "American Society for Clinical Pathology",
  kind: "scrape",
  category: "pathology",
  base: "https://www.ascp.org",
  port: 6401,
  version: "0.1.0",
});

registerTools(server);
server.run();

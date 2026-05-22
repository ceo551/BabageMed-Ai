import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "scai",
  name: "Society for Cardiovascular Angiography & Interventions",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.scai.org",
  port: 6208,
  version: "0.1.0",
});

registerTools(server);
server.run();

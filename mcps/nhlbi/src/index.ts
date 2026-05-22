import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nhlbi",
  name: "NHLBI",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.nhlbi.nih.gov",
  port: 6137,
  version: "0.1.0",
});

registerTools(server);
server.run();

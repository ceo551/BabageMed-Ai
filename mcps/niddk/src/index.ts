import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "niddk",
  name: "NIDDK",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.niddk.nih.gov",
  port: 6134,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dailymed",
  name: "DailyMed",
  kind: "api",
  category: "drugs",
  base: "https://dailymed.nlm.nih.gov/dailymed/services/v2",
  port: 6120,
  version: "0.1.0",
});

registerTools(server);
server.run();

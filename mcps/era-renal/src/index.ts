import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "era-renal",
  name: "European Renal Association",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.era-online.org",
  port: 6460,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ema",
  name: "European Medicines Agency",
  kind: "scrape",
  category: "drug-regulation",
  base: "https://www.ema.europa.eu",
  port: 6273,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rki",
  name: "Robert Koch Institute (Germany)",
  kind: "scrape",
  category: "public-health",
  base: "https://www.rki.de/EN",
  port: 6311,
  version: "0.1.0",
});

registerTools(server);
server.run();

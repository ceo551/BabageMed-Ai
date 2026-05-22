import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "karger-oa",
  name: "Karger Open Access",
  kind: "scrape",
  category: "oa-journal",
  base: "https://karger.com/services/open-access",
  port: 6506,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ukhsa",
  name: "UK Health Security Agency",
  kind: "scrape",
  category: "public-health",
  base: "https://www.gov.uk/government/organisations/uk-health-security-agency",
  port: 6304,
  version: "0.1.0",
});

registerTools(server);
server.run();

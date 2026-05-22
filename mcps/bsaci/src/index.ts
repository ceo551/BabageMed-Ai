import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bsaci",
  name: "British Society for Allergy & Clinical Immunology",
  kind: "scrape",
  category: "allergy",
  base: "https://www.bsaci.org",
  port: 6399,
  version: "0.1.0",
});

registerTools(server);
server.run();

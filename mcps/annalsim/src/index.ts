import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "annalsim",
  name: "Annals of Internal Medicine",
  kind: "scrape",
  category: "internal-medicine",
  base: "https://www.acpjournals.org/journal/aim",
  port: 6458,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bps",
  name: "British Pharmacological Society",
  kind: "scrape",
  category: "pharmacology",
  base: "https://www.bps.ac.uk",
  port: 6280,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bnf",
  name: "British National Formulary",
  kind: "scrape",
  category: "pharmacology",
  base: "https://bnf.nice.org.uk",
  port: 6267,
  version: "0.1.0",
});

registerTools(server);
server.run();

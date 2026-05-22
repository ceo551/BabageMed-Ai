import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "biocodex",
  name: "Biocodex Microbiota",
  kind: "scrape",
  category: "microbiota",
  base: "https://www.biocodexmicrobiotainstitute.com",
  port: 6135,
  version: "0.1.0",
});

registerTools(server);
server.run();

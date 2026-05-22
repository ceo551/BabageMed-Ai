import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aacap",
  name: "American Academy of Child & Adolescent Psychiatry",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.aacap.org",
  port: 6247,
  version: "0.1.0",
});

registerTools(server);
server.run();

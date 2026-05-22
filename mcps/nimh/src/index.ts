import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nimh",
  name: "NIMH",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.nimh.nih.gov",
  port: 6152,
  version: "0.1.0",
});

registerTools(server);
server.run();

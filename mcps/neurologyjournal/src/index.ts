import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "neurologyjournal",
  name: "Neurology Journal (AAN)",
  kind: "scrape",
  category: "neurology",
  base: "https://www.neurology.org",
  port: 6243,
  version: "0.1.0",
});

registerTools(server);
server.run();

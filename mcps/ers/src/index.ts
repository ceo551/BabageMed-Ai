import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ers",
  name: "European Respiratory Society",
  kind: "scrape",
  category: "pulmonology",
  base: "https://www.ersnet.org",
  port: 6340,
  version: "0.1.0",
});

registerTools(server);
server.run();

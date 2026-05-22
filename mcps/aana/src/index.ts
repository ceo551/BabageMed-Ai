import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aana",
  name: "Arthroscopy Association of North America",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.aana.org",
  port: 6377,
  version: "0.1.0",
});

registerTools(server);
server.run();

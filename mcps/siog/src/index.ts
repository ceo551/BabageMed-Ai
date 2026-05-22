import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "siog",
  name: "International Society of Geriatric Oncology",
  kind: "scrape",
  category: "geriatric-oncology",
  base: "https://siog.org",
  port: 6228,
  version: "0.1.0",
});

registerTools(server);
server.run();

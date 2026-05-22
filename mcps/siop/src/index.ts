import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "siop",
  name: "International Society of Paediatric Oncology",
  kind: "scrape",
  category: "pediatric-oncology",
  base: "https://siop-online.org",
  port: 6229,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bva",
  name: "British Veterinary Association",
  kind: "scrape",
  category: "veterinary",
  base: "https://www.bva.co.uk",
  port: 6469,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wsava",
  name: "World Small Animal Veterinary Association",
  kind: "scrape",
  category: "veterinary",
  base: "https://wsava.org",
  port: 6468,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aao-ent",
  name: "American Academy of Otolaryngology",
  kind: "scrape",
  category: "ent",
  base: "https://www.entnet.org",
  port: 6351,
  version: "0.1.0",
});

registerTools(server);
server.run();

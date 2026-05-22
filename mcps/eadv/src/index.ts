import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eadv",
  name: "European Academy of Dermatology and Venereology",
  kind: "scrape",
  category: "dermatology",
  base: "https://eadv.org",
  port: 6347,
  version: "0.1.0",
});

registerTools(server);
server.run();

import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "vettimes",
  name: "Vet Times",
  kind: "scrape",
  category: "veterinary",
  base: "https://www.vettimes.co.uk",
  port: 6470,
  version: "0.1.0",
});

registerTools(server);
server.run();

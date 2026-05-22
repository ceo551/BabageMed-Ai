import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "orthobullets",
  name: "Orthobullets",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.orthobullets.com",
  port: 6374,
  version: "0.1.0",
});

registerTools(server);
server.run();

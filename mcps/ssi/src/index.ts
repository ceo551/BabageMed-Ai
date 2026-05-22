import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ssi",
  name: "Statens Serum Institut (Denmark)",
  kind: "scrape",
  category: "public-health",
  base: "https://www.ssi.dk/english",
  port: 6310,
  version: "0.1.0",
});

registerTools(server);
server.run();

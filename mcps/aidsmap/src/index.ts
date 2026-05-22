import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aidsmap",
  name: "AIDSMap (NAM)",
  kind: "scrape",
  category: "infectious-disease",
  base: "https://www.aidsmap.com",
  port: 6394,
  version: "0.1.0",
});

registerTools(server);
server.run();

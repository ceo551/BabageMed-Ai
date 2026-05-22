import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eular",
  name: "EULAR",
  kind: "scrape",
  category: "rheumatology",
  base: "https://www.eular.org",
  port: 6463,
  version: "0.1.0",
});

registerTools(server);
server.run();

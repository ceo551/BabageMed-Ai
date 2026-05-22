import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aasld",
  name: "AASLD",
  kind: "scrape",
  category: "hepatology",
  base: "https://www.aasld.org",
  port: 6333,
  version: "0.1.0",
});

registerTools(server);
server.run();

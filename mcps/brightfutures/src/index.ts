import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "brightfutures",
  name: "Bright Futures (AAP)",
  kind: "scrape",
  category: "pediatrics",
  base: "https://brightfutures.aap.org",
  port: 6252,
  version: "0.1.0",
});

registerTools(server);
server.run();

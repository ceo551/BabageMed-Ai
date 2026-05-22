import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wpa",
  name: "World Psychiatric Association",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.wpanet.org",
  port: 6245,
  version: "0.1.0",
});

registerTools(server);
server.run();

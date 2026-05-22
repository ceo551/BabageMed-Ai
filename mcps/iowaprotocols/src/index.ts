import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "iowaprotocols",
  name: "Iowa Protocols",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://webeye.ophth.uiowa.edu",
  port: 6169,
  version: "0.1.0",
});

registerTools(server);
server.run();

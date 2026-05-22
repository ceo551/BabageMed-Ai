import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "actacc",
  name: "Association of Cardiothoracic Anaesthesia & Critical Care",
  kind: "scrape",
  category: "anesthesia",
  base: "https://actacc.org",
  port: 6221,
  version: "0.1.0",
});

registerTools(server);
server.run();

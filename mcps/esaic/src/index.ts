import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "esaic",
  name: "European Society of Anaesthesiology & Intensive Care",
  kind: "scrape",
  category: "anesthesia",
  base: "https://www.esaic.org",
  port: 6295,
  version: "0.1.0",
});

registerTools(server);
server.run();

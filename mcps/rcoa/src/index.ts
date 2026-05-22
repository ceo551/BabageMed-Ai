import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcoa",
  name: "Royal College of Anaesthetists",
  kind: "scrape",
  category: "anesthesia",
  base: "https://www.rcoa.ac.uk",
  port: 6294,
  version: "0.1.0",
});

registerTools(server);
server.run();

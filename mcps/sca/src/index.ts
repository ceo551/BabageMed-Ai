import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sca",
  name: "Society of Cardiovascular Anesthesiologists",
  kind: "scrape",
  category: "anesthesia",
  base: "https://scahq.org",
  port: 6220,
  version: "0.1.0",
});

registerTools(server);
server.run();

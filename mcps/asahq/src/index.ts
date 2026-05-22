import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asahq",
  name: "American Society of Anesthesiologists",
  kind: "scrape",
  category: "anesthesia",
  base: "https://www.asahq.org",
  port: 6293,
  version: "0.1.0",
});

registerTools(server);
server.run();

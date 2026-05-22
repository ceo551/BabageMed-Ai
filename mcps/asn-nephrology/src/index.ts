import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asn-nephrology",
  name: "American Society of Nephrology",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.asn-online.org",
  port: 6459,
  version: "0.1.0",
});

registerTools(server);
server.run();

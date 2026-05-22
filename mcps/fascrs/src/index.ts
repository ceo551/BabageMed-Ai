import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "fascrs",
  name: "American Society of Colon and Rectal Surgeons",
  kind: "scrape",
  category: "surgery",
  base: "https://fascrs.org",
  port: 6287,
  version: "0.1.0",
});

registerTools(server);
server.run();

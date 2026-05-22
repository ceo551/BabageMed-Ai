import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dermnet",
  name: "DermNet NZ",
  kind: "scrape",
  category: "dermatology",
  base: "https://www.dermnetnz.org",
  port: 6348,
  version: "0.1.0",
});

registerTools(server);
server.run();

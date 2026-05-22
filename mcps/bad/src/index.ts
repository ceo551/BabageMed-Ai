import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bad",
  name: "British Association of Dermatologists",
  kind: "scrape",
  category: "dermatology",
  base: "https://www.bad.org.uk",
  port: 6346,
  version: "0.1.0",
});

registerTools(server);
server.run();

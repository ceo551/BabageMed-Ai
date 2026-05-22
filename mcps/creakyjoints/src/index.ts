import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "creakyjoints",
  name: "CreakyJoints",
  kind: "scrape",
  category: "rheumatology",
  base: "https://creakyjoints.org",
  port: 6147,
  version: "0.1.0",
});

registerTools(server);
server.run();

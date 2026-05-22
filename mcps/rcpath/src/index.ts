import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcpath",
  name: "Royal College of Pathologists",
  kind: "scrape",
  category: "pathology",
  base: "https://www.rcpath.org",
  port: 6403,
  version: "0.1.0",
});

registerTools(server);
server.run();

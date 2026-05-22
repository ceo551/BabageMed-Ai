import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "wfh",
  name: "World Federation of Hemophilia",
  kind: "scrape",
  category: "hematology",
  base: "https://wfh.org",
  port: 6390,
  version: "0.1.0",
});

registerTools(server);
server.run();

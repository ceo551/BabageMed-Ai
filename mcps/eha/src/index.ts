import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eha",
  name: "European Hematology Association",
  kind: "scrape",
  category: "hematology",
  base: "https://ehaweb.org",
  port: 6388,
  version: "0.1.0",
});

registerTools(server);
server.run();
